import { afterEach, expect, it, vi } from "vitest"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { showSubtitles, type Frame } from "./controller"

const host = { bars: () => ({ top: 0, bottom: 0 }) }
const options = { isEnabled: () => true, lookUp: () => {}, isShown: () => false, close: () => {} }

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ""
})

it("leaves the site its own subtitles when a frame fails, and shows them again once one works", async () => {
  vi.stubGlobal("browser", {
    storage: { local: { get: async () => ({}) }, onChanged: { addListener: () => {} } },
  })
  const ctx = {
    onInvalidated: () => {},
    signal: new AbortController().signal,
    requestAnimationFrame: (tick: () => void) => requestAnimationFrame(tick),
  } as unknown as ContentScriptContext
  document.body.innerHTML = `<div class="player" style="position: relative; width: 640px; height: 360px"><video></video></div>`
  const frame: Frame = {
    player: document.querySelector<HTMLElement>(".player")!,
    video: document.querySelector("video")!,
    track: { lang: "ja", cues: [{ startMs: 0, endMs: 60_000, text: "こんにちは" }], fast: false },
    hidden: false,
    key: undefined,
  }
  let failing = false
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  showSubtitles(ctx, options, {
    host,
    isOn: async () => true,
    keys: [],
    frame: () => {
      if (failing) {
        throw new RangeError("Maximum call stack size exceeded")
      }
      return frame
    },
  }).start()
  const overlay = () => document.querySelector("[data-dadict-captions]")
  await vi.waitFor(() => expect(overlay()).not.toBeNull())
  failing = true
  await vi.waitFor(() => expect(overlay()).toBeNull())
  await new Promise((resolve) => setTimeout(resolve, 100))
  expect(warn).toHaveBeenCalledOnce()
  failing = false
  await vi.waitFor(() => expect(overlay()).not.toBeNull())
  warn.mockRestore()
})
