/**
 * Measures what the extension costs a YouTube video's start, against real YouTube.
 * Each video loads several times with the extension and without, in turns, with captions on so the player downloads a track.
 * `bun run youtube:perf` measures every video. Pass video ids to measure only those, and `--rounds=8` for more loads of each.
 * `--against=<folder>` compares with another build of the extension rather than with none, to see what a change costs.
 * It fails when our caption handler holds the page up for too long, or never got a track. The rest is for reading,
 * because YouTube's own loads differ too much from one to the next to pass or fail on.
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

type Side = { name: string; playing: Array<number>; longTasks: Array<number>; handler: Array<number> }

const videos: Array<Video> = [
  { id: "uN1Zx-Ia-SE", lang: "de", note: "de, creator track" },
  { id: "BvmdHbYPPCM", lang: "pl", note: "pl, auto track of 72 minutes" },
]

/** Long tasks count up to here, which takes in the video's start and the track's download. */
const WINDOW_MS = 6000
const PLAYING_WAIT_MS = 30_000
/** A frame is 16 ms, so past this the handler shows as a stutter. */
const HANDLER_BUDGET_MS = 50

const args = process.argv.slice(2)
const option = (name: string): string | undefined =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
const rounds = Number(option("rounds") ?? 5)
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

const spread = (values: ReadonlyArray<number>): string =>
  values.length === 0
    ? "no loads"
    : `${Math.round(median(values))} ms (${Math.round(Math.min(...values))} to ${Math.round(Math.max(...values))})`

const signed = (ms: number): string => `${ms >= 0 ? "+" : ""}${Math.round(ms)} ms`

const measureVideo = async (video: Video, userAgent: string): Promise<Array<string>> => {
  const sessions: Array<{ name: string; profile: string; context: BrowserContext; page: Page }> = []
  for (const { name, extension } of sides) {
    const profile = mkdtempSync(join(tmpdir(), "dadict-youtube-perf-"))
    const context = await openYouTube({
      profile,
      userAgent,
      locale: video.lang,
      extension,
      args: ["--autoplay-policy=no-user-gesture-required"],
    })
    await context.addInitScript(measure, { event: TIMEDTEXT_EVENT, windowMs: WINDOW_MS })
    const page = await context.newPage()
    await turnCaptionsOn(page, video)
    sessions.push({ name, profile, context, page })
  }

  const loads = new Map(sides.map(({ name }) => [name, new Array<Load>()]))
  let ads = 0
  for (let round = 0; round < rounds; round++) {
    // Each goes first in turn, so neither always loads into the warmer network.
    for (const { name, page } of round % 2 === 0 ? sessions : sessions.toReversed()) {
      const load = await loadOnce(page, video)
      // An ad plays first and loads the video behind it, so the load says nothing about ours.
      if (load.adSeen) {
        ads++
      } else {
        loads.get(name)!.push(load)
      }
    }
  }
  for (const { profile, context } of sessions) {
    await context.close()
    rmSync(profile, { recursive: true, force: true })
  }

  const [base, built] = sides.map(({ name }) => {
    const side = loads.get(name)!
    return {
      name: name.padEnd(7),
      playing: side.flatMap(({ playingMs }) => (playingMs === undefined ? [] : [playingMs])),
      longTasks: side.map(({ longTaskMs }) => longTaskMs),
      handler: side.flatMap(({ handlerMs }) => handlerMs),
    }
  }) as [Side, Side]
  const { handler } = built

  console.log(`${video.id}  ${video.note}`)
  console.log(`  to playing   ${base.name} ${spread(base.playing)}`)
  console.log(`               ${built.name} ${spread(built.playing)}`)
  if (base.playing.length > 0 && built.playing.length > 0) {
    console.log(`               change  ${signed(median(built.playing) - median(base.playing))}`)
  }
  console.log(`  long tasks   ${base.name} ${spread(base.longTasks)}`)
  console.log(`               ${built.name} ${spread(built.longTasks)}`)
  if (base.longTasks.length > 0 && built.longTasks.length > 0) {
    console.log(`               change  ${signed(median(built.longTasks) - median(base.longTasks))}`)
  }
  if (base.handler.length > 0) {
    console.log(`  its handler  ${spread(base.handler)} over ${base.handler.length} tracks`)
  }
  console.log(
    `  our handler  ${handler.length === 0 ? "no track" : `${spread(handler)} over ${handler.length} tracks`}`,
  )
  if (ads > 0) {
    console.log(`  ${ads} loads left out for an ad`)
  }

  const problems: Array<string> = []
  if (handler.length === 0) {
    problems.push("our hook passed on no track, so the handler was not measured")
  } else if (Math.max(...handler) > HANDLER_BUDGET_MS) {
    problems.push(
      `our handler held the page for ${Math.round(Math.max(...handler))} ms, over ${HANDLER_BUDGET_MS} ms`,
    )
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
