/**
 * Measures what the extension costs a YouTube video's start, against real YouTube.
 * A round loads the video without the extension and with it, back to back and with captions on, so the player downloads a track.
 * YouTube sends each track only once a run, and later loads get that copy, so the rounds do not get the IP rate-limited.
 * Each round is compared on its own, because YouTube's loads differ from one minute to the next and a slow spell then hits both.
 * `bun run youtube:perf` measures every video. Pass video ids to measure only those, and `--rounds=8` for more rounds of each.
 * `--against=<folder>` compares with another build of the extension rather than with none, to see what a change costs.
 * It fails when the extension slows a video's start by more than `--limit=<percent>` in the middle round, or never got a track.
 */
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import type { BrowserContext, Page } from "playwright"
import { TIMEDTEXT_EVENT } from "../src/lib/captions"
import { buildExtension, EXTENSION, openYouTube, viewerUserAgent, waitForAds } from "./youtube-browser"

type Video = { id: string; lang: string; note: string }

type Load = {
  /** From the start of the load to the video's first `playing`. Unset when it never played. */
  playingMs: number | undefined
  /** Tasks of 50 ms and more on the page's thread, which is everything that makes it stutter. */
  longTaskMs: number
  /** How long dispatching each track took, which is our handler parsing and cutting it. */
  handlerMs: Array<number>
  adSeen: boolean
}

/** One round: a load of what the build is measured against, and one of the build. */
type Round = { base: Load; built: Load }

const videos: Array<Video> = [
  { id: "uN1Zx-Ia-SE", lang: "de", note: "de, creator track" },
  { id: "BvmdHbYPPCM", lang: "pl", note: "pl, auto track of 72 minutes" },
]

/** Long tasks count up to here, which takes in the video's start and the track's download. */
const WINDOW_MS = 6000
const PLAYING_WAIT_MS = 30_000
/** How much slower the build may be, in percent. Rounds of the same build differ by about this much. */
const LIMIT_PERCENT = 50

const args = process.argv.slice(2)
const option = (name: string): string | undefined =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
const rounds = Number(option("rounds") ?? 5)
const limit = Number(option("limit") ?? LIMIT_PERCENT)
const against = option("against")
/** What the build is measured against, and the build itself. */
const sides = [
  against === undefined
    ? { name: "without", extension: undefined }
    : { name: "against", extension: resolve(against) },
  { name: "with", extension: EXTENSION },
]
const only = args.filter((arg) => !arg.startsWith("--"))
const picked = only.length === 0 ? videos : videos.filter(({ id }) => only.includes(id))

/** Runs in the page before YouTube does, on every load. */
const measure = ({ event, windowMs }: { event: string; windowMs: number }) => {
  const load: Load = { playingMs: undefined, longTaskMs: 0, handlerMs: [], adSeen: false }
  ;(window as unknown as { dadictLoad: Load }).dadictLoad = load
  document.addEventListener(
    "playing",
    ({ target }) => {
      const player = target instanceof Element ? target.closest("#movie_player") : null
      if (player === null) {
        return
      }
      if (player.classList.contains("ad-showing")) {
        load.adSeen = true
      } else {
        load.playingMs ??= performance.now()
      }
    },
    { capture: true },
  )
  new PerformanceObserver((list) => {
    for (const { startTime, duration } of list.getEntries()) {
      if (startTime < windowMs) {
        load.longTaskMs += duration
      }
    }
  }).observe({ type: "longtask", buffered: true })
  // Our hook looks `dispatchEvent` up when it calls it, so this times the content script's listener.
  const dispatch = window.dispatchEvent.bind(window)
  window.dispatchEvent = (dispatched: Event) => {
    const start = performance.now()
    const result = dispatch(dispatched)
    if (dispatched.type === event) {
      load.handlerMs.push(performance.now() - start)
    }
    return result
  }
}

/** The tracks YouTube sent this run, by what the player asked for. */
const tracks = new Map<string, string>()

const keepTracks = (context: BrowserContext) =>
  context.route("**/api/timedtext?**", async (route) => {
    const params = new URL(route.request().url()).searchParams
    const key = ["v", "lang", "kind", "tlang", "fmt"].map((name) => params.get(name)).join(" ")
    const kept = tracks.get(key)
    if (kept !== undefined) {
      return route.fulfill({ contentType: "application/json", body: kept })
    }
    const response = await route.fetch()
    const body = await response.text()
    // The player asks before its token is ready and gets nothing, which is no track to keep.
    if (response.ok() && body !== "") {
      tracks.set(key, body)
    }
    return route.fulfill({ response, body })
  })

const url = (video: Video) => `https://www.youtube.com/watch?v=${video.id}`

/** Turns captions on like a viewer, which the player remembers for the loads that follow. */
const turnCaptionsOn = async (page: Page, video: Video) => {
  await page.goto(url(video), { waitUntil: "domcontentloaded" })
  await page.waitForSelector("#movie_player video", { timeout: 30_000 })
  await waitForAds(page)
  await page.evaluate(() => {
    const button = document.querySelector<HTMLElement>("#movie_player .ytp-subtitles-button")
    if (button?.getAttribute("aria-pressed") !== "true") {
      button?.click()
    }
  })
  await page.waitForTimeout(3000)
}

const loadOnce = async (page: Page, video: Video): Promise<Load> => {
  await page.goto(url(video), { waitUntil: "domcontentloaded" })
  await page
    .waitForFunction(
      () => (window as unknown as { dadictLoad: Load }).dadictLoad.playingMs !== undefined,
      undefined,
      { timeout: PLAYING_WAIT_MS },
    )
    .catch(() => {})
  await page.waitForFunction((windowMs) => performance.now() > windowMs, WINDOW_MS)
  const load = await page.evaluate(() => (window as unknown as { dadictLoad: Load }).dadictLoad)
  // So the video does not play on while the other browser is measured.
  await page.goto("about:blank")
  return load
}

const median = (values: ReadonlyArray<number>): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

const spread = (values: ReadonlyArray<number>, unit = " ms"): string =>
  `${Math.round(median(values))}${unit} (${Math.round(Math.min(...values))} to ${Math.round(Math.max(...values))})`

/** How much more the build took than what it is measured against, in percent, for each round. */
const slowdown = (rounds: ReadonlyArray<Round>, of: (load: Load) => number): Array<number> =>
  rounds.map(({ base, built }) => ((of(built) - of(base)) / of(base)) * 100)

const measureVideo = async (video: Video, userAgent: string): Promise<Array<string>> => {
  const sessions: Array<{ profile: string; context: BrowserContext; page: Page }> = []
  for (const { extension } of sides) {
    const profile = mkdtempSync(join(tmpdir(), "dadict-youtube-perf-"))
    const context = await openYouTube({
      profile,
      userAgent,
      locale: video.lang,
      extension,
      args: ["--autoplay-policy=no-user-gesture-required"],
    })
    await context.addInitScript(measure, { event: TIMEDTEXT_EVENT, windowMs: WINDOW_MS })
    await keepTracks(context)
    const page = await context.newPage()
    await turnCaptionsOn(page, video)
    sessions.push({ profile, context, page })
  }
  const [base, built] = sessions as [(typeof sessions)[number], (typeof sessions)[number]]

  const kept: Array<Round> = []
  let ads = 0
  for (let tried = 0; kept.length < rounds && tried < rounds * 2; tried++) {
    // Each goes first in turn, so neither always loads into the warmer network.
    const builtFirst = tried % 2 === 1
    const first = await loadOnce(builtFirst ? built.page : base.page, video)
    const second = await loadOnce(builtFirst ? base.page : built.page, video)
    const round = builtFirst ? { base: second, built: first } : { base: first, built: second }
    // An ad plays first and loads the video behind it, so the round says nothing about ours.
    if (round.base.adSeen || round.built.adSeen) {
      ads++
    } else {
      kept.push(round)
    }
  }
  for (const { profile, context } of sessions) {
    await context.close()
    rmSync(profile, { recursive: true, force: true })
  }

  const played = kept.filter(
    ({ base, built }) => base.playingMs !== undefined && built.playingMs !== undefined,
  )
  const handler = kept.flatMap(({ built }) => built.handlerMs)
  const [baseName, builtName] = sides.map(({ name }) => name.padEnd(7)) as [string, string]
  const problems: Array<string> = []

  console.log(
    `${video.id}  ${video.note}, ${kept.length} rounds${ads === 0 ? "" : `, ${ads} more left out for an ad`}`,
  )
  const report = (name: string, rounds: ReadonlyArray<Round>, of: (load: Load) => number) => {
    if (rounds.length === 0) {
      problems.push(`no round to compare ${name} in`)
      return
    }
    const slower = slowdown(rounds, of)
    console.log(`  ${name.padEnd(12)} ${baseName} ${spread(rounds.map(({ base }) => of(base)))}`)
    console.log(`  ${"".padEnd(12)} ${builtName} ${spread(rounds.map(({ built }) => of(built)))}`)
    console.log(`  ${"".padEnd(12)} slower  ${spread(slower, "%")} round by round`)
    if (median(slower) > limit) {
      problems.push(`${name} took ${Math.round(median(slower))}% longer, over ${limit}%`)
    }
  }
  report("to playing", played, ({ playingMs }) => playingMs!)
  report("long tasks", kept, ({ longTaskMs }) => longTaskMs)
  if (handler.length === 0) {
    problems.push("our hook passed on no track")
  } else {
    console.log(`  our handler  ${spread(handler)} over ${handler.length} tracks`)
  }
  return problems
}

buildExtension()
const userAgent = await viewerUserAgent()

let failed = false
for (const video of picked) {
  const problems = await measureVideo(video, userAgent).catch((error: unknown) => [String(error)])
  failed ||= problems.length > 0
  for (const problem of problems) {
    console.log(`  FAIL ${problem}`)
  }
}

process.exit(failed ? 1 : 0)
