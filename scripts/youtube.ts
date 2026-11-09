/**
 * Checks what the YouTube subtitles rely on against real YouTube, and records caption fixtures from it.
 * It builds the extension and loads it, so the check covers our hook too.
 * `bun run youtube` checks every video. Pass video ids to check only those, and `--record` to save their fixtures.
 */
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chromium, type Page, type Response } from "playwright"
import { TIMEDTEXT_EVENT } from "../src/lib/captions"

type Track = { lang: string; kind: "manual" | "asr" }
type Video = {
  id: string
  /** What is spoken, which is also the browser's language, so YouTube neither dubs the audio nor translates the title. */
  lang: string
  note: string
  tracks: Array<Track>
}

const EXTENSION = new URL("../.output/chrome-mv3", import.meta.url).pathname

const FIXTURES = new URL("../src/entrypoints/content/youtube/fixtures/", import.meta.url)

/** Fixtures keep only the start of a video, which is enough for cue cutting and keeps the repo small. */
const FIXTURE_MS = 5 * 60_000

const videos: Array<Video> = [
  {
    id: "XwI2ku2_7rU",
    lang: "ja",
    note: "ja, creator and auto",
    tracks: [
      { lang: "ja", kind: "manual" },
      { lang: "ja", kind: "asr" },
    ],
  },
  {
    id: "0hyv-mrTxJQ",
    lang: "pl",
    note: "pl, creator and auto",
    tracks: [
      { lang: "pl", kind: "manual" },
      { lang: "pl", kind: "asr" },
    ],
  },
  {
    id: "uN1Zx-Ia-SE",
    lang: "de",
    note: "de, creator and auto",
    tracks: [
      { lang: "de", kind: "manual" },
      { lang: "de", kind: "asr" },
    ],
  },
  {
    id: "6WCgEXrezyo",
    lang: "uk",
    note: "uk, creator and auto",
    tracks: [
      { lang: "uk", kind: "manual" },
      { lang: "uk", kind: "asr" },
    ],
  },
  {
    id: "BvmdHbYPPCM",
    lang: "pl",
    note: "pl, auto only, fast with many speakers",
    tracks: [{ lang: "pl", kind: "asr" }],
  },
  { id: "IEkZoYo2BVQ", lang: "uk", note: "no caption tracks", tracks: [] },
]

const AD_WAIT_MS = 90_000
const TRACK_WAIT_MS = 10_000
const TRACK_ATTEMPTS = 3

const args = process.argv.slice(2)
const record = args.includes("--record")
const only = args.filter((arg) => !arg.startsWith("--"))
const picked = only.length === 0 ? videos : videos.filter(({ id }) => only.includes(id))

type Json3 = {
  events?: Array<{ tStartMs?: number; segs?: Array<{ tOffsetMs?: number; acAsrConf?: number }> }>
}

const trackKey = ({ lang, kind }: Track) => `${kind}:${lang}`

const fixtureName = (video: Video, track: Track) => `${track.lang}.${track.kind}.${video.id}.json`

/** The start of the track, one event per line so diffs stay readable. */
const trimmed = (json3: Json3) => {
  const events = (json3.events ?? [])
    .filter(({ tStartMs = 0 }) => tStartMs < FIXTURE_MS)
    .map((event) =>
      event.segs === undefined
        ? event
        : { ...event, segs: event.segs.map(({ acAsrConf: _, ...seg }) => seg) },
    )
  return `{"events":[\n${events.map((event) => JSON.stringify(event)).join(",\n")}\n]}\n`
}

/** Waits out ads, skipping them when YouTube offers it. */
const waitForAds = async (page: Page) => {
  const deadline = Date.now() + AD_WAIT_MS
  while (Date.now() < deadline) {
    const showing = await page.evaluate(() =>
      document.querySelector("#movie_player")?.classList.contains("ad-showing"),
    )
    if (!showing) {
      return
    }
    await page
      .locator(".ytp-skip-ad-button, .ytp-ad-skip-button-modern")
      .click({ timeout: 1000 })
      .catch(() => {})
    await page.waitForTimeout(1000)
  }
  throw new Error("an ad was still showing")
}

/** Turns captions off and on with the track, so the player asks for it again. Resolves to the language code it picked. */
const selectTrack = (page: Page, track: Track): Promise<string | undefined> =>
  page.evaluate((track) => {
    const player = document.querySelector("#movie_player") as unknown as {
      getOption: (
        module: string,
        option: string,
        args?: object,
      ) => Array<{ languageCode: string; kind: string }>
      setOption: (module: string, option: string, value: object) => void
    }
    const match = player
      .getOption("captions", "tracklist", { includeAsr: true })
      .find(
        ({ languageCode, kind }) =>
          languageCode.split("-")[0] === track.lang && (kind === "asr") === (track.kind === "asr"),
      )
    if (match === undefined) {
      return undefined
    }
    player.setOption("captions", "track", {})
    player.setOption("captions", "track", match)
    return match.languageCode
  }, track)

const checkVideo = async (page: Page, video: Video): Promise<Array<string>> => {
  const problems: Array<string> = []
  const bodies = new Map<string, Json3>()
  const onResponse = async (response: Response) => {
    const url = new URL(response.url())
    // A `tlang` response is YouTube's machine translation of the track, not the track.
    if (url.pathname !== "/api/timedtext" || url.searchParams.has("tlang")) {
      return
    }
    const key = trackKey({
      lang: url.searchParams.get("lang") ?? "",
      kind: url.searchParams.get("kind") === "asr" ? "asr" : "manual",
    })
    const text = await response.text().catch(() => "")
    // The player asks before its token is ready and gets nothing, then asks again with it.
    if (text === "") {
      if (url.searchParams.has("pot")) {
        problems.push(`timedtext ${key} came back empty with a token`)
      }
      return
    }
    bodies.set(key, JSON.parse(text) as Json3)
  }
  page.on("response", onResponse)

  await page.goto(`https://www.youtube.com/watch?v=${video.id}`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("#movie_player video", { timeout: 30_000 })
  await waitForAds(page)

  const dom = await page.evaluate(() => {
    const player = document.querySelector("#movie_player") as (HTMLElement & Record<string, unknown>) | null
    return {
      player: player !== null,
      "player API": typeof player?.getOption === "function" && typeof player?.setOption === "function",
      "CC button": document.querySelector("#movie_player .ytp-subtitles-button") !== null,
    }
  })
  for (const [name, found] of Object.entries(dom)) {
    if (!found) {
      problems.push(`missing ${name}`)
    }
  }

  const listed = await page.evaluate(() => {
    const player = document.querySelector("#movie_player") as unknown as {
      loadModule?: (name: string) => void
      getOption?: (module: string, option: string, args?: object) => unknown
    }
    player.loadModule?.("captions")
    const list = player.getOption?.("captions", "tracklist", { includeAsr: true })
    return Array.isArray(list) ? (list as Array<{ languageCode: string }>) : []
  })
  if (video.tracks.length === 0 && listed.length > 0) {
    problems.push(`expected no tracks, found ${listed.map(({ languageCode }) => languageCode).join(", ")}`)
  }

  for (const track of video.tracks) {
    let key: string | undefined
    for (let attempt = 1; attempt <= TRACK_ATTEMPTS && (key === undefined || !bodies.has(key)); attempt++) {
      const switched = await selectTrack(page, track)
      if (switched === undefined) {
        break
      }
      key = trackKey({ ...track, lang: switched })
      const deadline = Date.now() + TRACK_WAIT_MS
      while (!bodies.has(key) && Date.now() < deadline) {
        await page.waitForTimeout(250)
      }
    }
    if (key === undefined) {
      problems.push(`no ${trackKey(track)} track listed`)
      continue
    }
    const body = bodies.get(key)
    if (body === undefined) {
      problems.push(`no timedtext response for ${key}`)
      continue
    }
    if (!body.events?.some(({ segs }) => Array.isArray(segs))) {
      problems.push(`${key} has no events with segs`)
    }
    if (
      track.kind === "asr" &&
      !body.events?.some(({ segs }) => segs?.some(({ tOffsetMs }) => tOffsetMs !== undefined))
    ) {
      problems.push(`${key} has no word timings`)
    }
    const hooked = await page.evaluate(() => (window as unknown as { hooked: Array<string> }).hooked)
    if (!hooked.includes(key)) {
      problems.push(`our hook did not pass on ${key}`)
    }
    if (record) {
      await Bun.write(new URL(fixtureName(video, track), FIXTURES), trimmed(body))
    }
  }

  if (
    video.tracks.length > 0 &&
    !(await page.evaluate(
      () => document.querySelector("#movie_player .ytp-caption-window-container") !== null,
    ))
  ) {
    problems.push("missing caption container")
  }

  page.off("response", onResponse)
  return problems
}

const build = Bun.spawnSync(["bun", "run", "build"], { stdout: "ignore", stderr: "inherit" })
if (build.exitCode !== 0) {
  process.exit(1)
}

// YouTube sends empty captions to a user agent that says HeadlessChrome.
const probe = await chromium.launch({ channel: "chromium" })
const userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${probe.version().split(".")[0]}.0.0.0 Safari/537.36`
await probe.close()

/** A fresh browser session per video, because the player carries caption and translation choices from one video to the next. */
const openPage = async (video: Video, profile: string): Promise<Page> => {
  const context = await chromium.launchPersistentContext(profile, {
    // The new headless mode, which loads extensions.
    channel: "chromium",
    headless: true,
    userAgent,
    locale: video.lang,
    // Like the user agent, `navigator.webdriver` gets empty captions.
    args: [
      "--disable-blink-features=AutomationControlled",
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
    ],
  })
  // Skips the EU consent page.
  await context.addCookies([{ name: "SOCS", value: "CAI", domain: ".youtube.com", path: "/" }])
  // Collects the tracks our hook passes on, the way `trackKey` names them.
  await context.addInitScript((event) => {
    const page = window as unknown as { hooked: Array<string> }
    page.hooked = []
    window.addEventListener(event, (passed) => {
      const { url } = JSON.parse((passed as CustomEvent<string>).detail) as { url: string }
      const params = new URL(url).searchParams
      if (!params.has("tlang")) {
        page.hooked.push(`${params.get("kind") === "asr" ? "asr" : "manual"}:${params.get("lang")}`)
      }
    })
  }, TIMEDTEXT_EVENT)
  return context.newPage()
}

let failed = false
for (const video of picked) {
  const profile = mkdtempSync(join(tmpdir(), "dadict-youtube-"))
  const page = await openPage(video, profile)
  const problems = await checkVideo(page, video).catch((error: unknown) => [String(error)])
  await page.context().close()
  rmSync(profile, { recursive: true, force: true })
  failed ||= problems.length > 0
  console.log(`${problems.length === 0 ? "ok  " : "FAIL"} ${video.id}  ${video.note}`)
  for (const problem of problems) {
    console.log(`       ${problem}`)
  }
}

process.exit(failed ? 1 : 0)
