/**
 * Checks in Firefox that a caption track gets from the page's world to the content script and shows as clickable subtitles.
 * YouTube answers an automated Firefox with empty tracks, so the check answers one of the page's requests itself.
 * `bun run youtube:firefox` builds the Firefox extension and loads it into a headless Firefox, which has to be installed.
 * Set `FIREFOX` to run another binary than `firefox`.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ORIGINAL_ATTRIBUTE, TIMEDTEXT_EVENT, TIMEDTEXT_READY_EVENT } from "../src/lib/captions"
import { buildExtension } from "./youtube-browser"

const EXTENSION = new URL("../.output/firefox-mv2", import.meta.url).pathname

const VIDEO = "uN1Zx-Ia-SE"
const LANG = "de"
const WORDS = ["Eine", "künstliche", "Intelligenz"]
/** One cue for the whole video, so it shows wherever playback is. */
const TRACK = JSON.stringify({
  events: [{ tStartMs: 0, dDurationMs: 24 * 3_600_000, segs: [{ utf8: WORDS.join(" ") }] }],
})

const PORT = 9347
const START_WAIT_MS = 30_000
const PAGE_WAIT_MS = 30_000
const AD_WAIT_MS = 90_000
const OVERLAY_WAIT_MS = 5000

// Playwright's Firefox does not load extensions, so this speaks WebDriver BiDi to the installed one.
type Bidi = { send: (method: string, params?: object) => Promise<any>; close: () => void }

const connect = async (port: number): Promise<Bidi> => {
  const deadline = Date.now() + START_WAIT_MS
  const open = (): Promise<WebSocket> =>
    new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/session`)
      socket.onopen = () => resolve(socket)
      socket.onerror = () => reject(new Error("Firefox did not open its debugging port"))
    })
  const retry = (): Promise<WebSocket> =>
    open().catch(async (error: unknown) => {
      if (Date.now() > deadline) {
        throw error
      }
      await Bun.sleep(250)
      return retry()
    })
  const socket = await retry()

  let lastId = 0
  const waiting = new Map<number, { resolve: (result: any) => void; reject: (error: Error) => void }>()
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(String(data)) as {
      id?: number
      type: string
      result?: unknown
      message?: string
    }
    const answered = message.id === undefined ? undefined : waiting.get(message.id)
    if (answered === undefined) {
      return
    }
    waiting.delete(message.id!)
    if (message.type === "error") {
      answered.reject(new Error(message.message))
    } else {
      answered.resolve(message.result)
    }
  }
  return {
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        lastId++
        waiting.set(lastId, { resolve, reject })
        socket.send(JSON.stringify({ id: lastId, method, params }))
      }),
    close: () => socket.close(),
  }
}

/** Runs in the page before YouTube does, to count the tracks the hook passes on. */
const countTracks = (event: string) => {
  const page = window as unknown as { dadictHeard: number }
  page.dadictHeard = 0
  window.addEventListener(event, () => page.dadictHeard++)
}

const pageState = (attribute: string) => {
  const player = document.querySelector("#movie_player")
  const overlay = document.querySelector<HTMLElement>("[data-dadict-captions]")
  const container = player?.querySelector(".ytp-caption-window-container")
  return {
    player: player?.querySelector("video") != null,
    ad: player?.classList.contains("ad-showing") === true,
    captionsOn: player?.querySelector(".ytp-subtitles-button")?.getAttribute("aria-pressed") === "true",
    contentScript: document.documentElement.hasAttribute(attribute),
    hooked: !XMLHttpRequest.prototype.open.toString().includes("[native code]"),
    words:
      overlay === null || overlay.hidden
        ? undefined
        : Array.from(overlay.querySelectorAll("[data-word]"), (word) => word.textContent),
    // Unset when the player has not made the container yet, which hides nothing either.
    youtubeHidden: container == null ? undefined : getComputedStyle(container).display === "none",
    heard: (window as unknown as { dadictHeard: number }).dadictHeard,
  }
}

/** Asks for a track the way the player does, and answers with `track` before YouTube can. */
const answerTrack = (url: string, track: string) => {
  const xhr = new XMLHttpRequest()
  xhr.open("GET", url)
  Object.defineProperty(xhr, "responseText", { value: track })
  xhr.send()
  xhr.dispatchEvent(new Event("load"))
  xhr.abort()
}

const check = async (bidi: Bidi): Promise<Array<string>> => {
  await bidi.send("session.new", { capabilities: {} })
  await bidi.send("webExtension.install", { extensionData: { type: "path", path: EXTENSION } })
  const { contexts } = (await bidi.send("browsingContext.getTree")) as {
    contexts: Array<{ context: string }>
  }
  const context = contexts[0]!.context

  /** Calls `fn` in the page with `args`, which like its result have to survive JSON. */
  const inPage = async <Args extends Array<string>, Result>(
    fn: (...args: Args) => Result,
    ...args: Args
  ): Promise<Result> => {
    const answer = (await bidi.send("script.callFunction", {
      functionDeclaration: `(...args) => JSON.stringify((${String(fn)})(...args) ?? null)`,
      arguments: args.map((value) => ({ type: "string", value })),
      target: { context },
      awaitPromise: false,
    })) as { type: string; result?: { value: string }; exceptionDetails?: { text: string } }
    if (answer.type !== "success") {
      throw new Error(answer.exceptionDetails?.text ?? "the page threw")
    }
    return JSON.parse(answer.result!.value) as Result
  }
  const state = () => inPage(pageState, ORIGINAL_ATTRIBUTE)
  /** The state once `done` holds, or as it is when `ms` have passed. */
  const waitFor = async (done: (now: Awaited<ReturnType<typeof state>>) => boolean, ms: number) => {
    const deadline = Date.now() + ms
    let now = await state()
    while (!done(now) && Date.now() < deadline) {
      await Bun.sleep(250)
      now = await state()
    }
    return now
  }

  await bidi.send("script.addPreloadScript", {
    functionDeclaration: `() => (${String(countTracks)})(${JSON.stringify(TIMEDTEXT_EVENT)})`,
  })
  // Skips the EU consent page.
  await bidi.send("storage.setCookie", {
    cookie: { name: "SOCS", value: { type: "string", value: "CAI" }, domain: ".youtube.com", path: "/" },
  })
  await bidi.send("browsingContext.navigate", {
    context,
    url: `https://www.youtube.com/watch?v=${VIDEO}`,
    wait: "interactive",
  })

  const loaded = await waitFor(({ player, contentScript }) => player && contentScript, PAGE_WAIT_MS)
  if (!loaded.player) {
    return ["no player on the page"]
  }
  if (!loaded.contentScript) {
    return ["the content script did not start, or the subtitles are off in its settings"]
  }
  if (!loaded.hooked) {
    return ["our hook is not on the page's XMLHttpRequest"]
  }
  if ((await waitFor(({ ad }) => !ad, AD_WAIT_MS)).ad) {
    return ["an ad was still showing"]
  }
  if (!(await state()).captionsOn) {
    await inPage(() => document.querySelector<HTMLElement>("#movie_player .ytp-subtitles-button")?.click())
  }
  if (!(await waitFor(({ captionsOn }) => captionsOn, OVERLAY_WAIT_MS)).captionsOn) {
    return ["the CC button did not turn on"]
  }

  const problems: Array<string> = []
  await inPage(answerTrack, `/api/timedtext?v=${VIDEO}&lang=${LANG}&fmt=json3`, TRACK)
  const shown = await waitFor(({ words }) => words !== undefined, OVERLAY_WAIT_MS)
  if (shown.heard === 0) {
    problems.push("our hook did not pass the track on")
  }
  if (JSON.stringify(shown.words) !== JSON.stringify(WORDS)) {
    problems.push(`the subtitles show ${JSON.stringify(shown.words)}, not ${JSON.stringify(WORDS)}`)
  }
  if (shown.youtubeHidden === false) {
    problems.push("YouTube's own captions still show under ours")
  }

  // A content script that starts later says so, and gets the track again.
  await inPage((event) => window.dispatchEvent(new CustomEvent(event)), TIMEDTEXT_READY_EVENT)
  const resent = await state()
  if (resent.heard !== shown.heard + 1) {
    problems.push(`the hook sent ${resent.heard - shown.heard} tracks again, not 1`)
  }
  return problems
}

buildExtension("build:firefox")

const profile = mkdtempSync(join(tmpdir(), "dadict-youtube-firefox-"))
writeFileSync(
  join(profile, "user.js"),
  [
    // The video plays, so the page is as a viewer has it, and nobody asked to hear it.
    'user_pref("media.autoplay.default", 0);',
    'user_pref("media.volume_scale", "0.0");',
    'user_pref("intl.accept_languages", "en-US, en");',
  ].join("\n"),
)
const firefox = Bun.spawn(
  [
    process.env.FIREFOX ?? "firefox",
    "--headless",
    "--no-remote",
    "--profile",
    profile,
    `--remote-debugging-port=${PORT}`,
    "about:blank",
  ],
  { stdout: "ignore", stderr: "ignore" },
)

let bidi: Bidi | undefined
const problems = await connect(PORT)
  .then((connected) => {
    bidi = connected
    return check(connected)
  })
  .catch((error: unknown) => [String(error)])
bidi?.close()
firefox.kill()
await firefox.exited
rmSync(profile, { recursive: true, force: true })

console.log(`${problems.length === 0 ? "ok  " : "FAIL"} ${VIDEO}  subtitles in Firefox`)
for (const problem of problems) {
  console.log(`       ${problem}`)
}
process.exit(problems.length === 0 ? 0 : 1)
