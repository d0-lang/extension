import { expect, it, vi } from "vitest"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { VIDEO_HOST } from "../video/player"
import { watchSiteFiles } from "./watch"

const FIXTURE = "/src/entrypoints/content/files/fixtures/ard.ttml"

const ctx = { onInvalidated: () => {} } as unknown as ContentScriptContext

const site = {
  hosts: /./u,
  file: /\/fixtures\/ard\.ttml$/u,
  isOn: () => true,
  host: { ...VIDEO_HOST, ownSubtitles: ".own" },
}

it("reads the subtitle file once the page loads it", async () => {
  const files = watchSiteFiles(ctx, site)
  expect(files.track()).toBeUndefined()
  await fetch(FIXTURE)
  await vi.waitFor(() => expect(files.track()).toBeDefined())
  expect(files.track()).toEqual({
    lang: "de",
    cues: [
      { startMs: 5080, endMs: 6200, text: "Guten Abend!", styles: [{ color: "#00ffff", from: 0, to: 12 }] },
    ],
    fast: false,
  })
})

it("leaves files that are not the site's", async () => {
  const files = watchSiteFiles(ctx, { ...site, file: /\/subtitle\// })
  await fetch(FIXTURE)
  await new Promise((resolve) => setTimeout(resolve, 200))
  expect(files.track()).toBeUndefined()
})
