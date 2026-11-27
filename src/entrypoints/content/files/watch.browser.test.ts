import { expect, it, vi } from "vitest"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { VIDEO_HOST } from "../video/player"
import type { SiteFiles } from "./sites"
import { watchSiteFiles } from "./watch"

const FIXTURE = "/src/entrypoints/content/files/fixtures/ard.ttml"

const ctx = { onInvalidated: () => {} } as unknown as ContentScriptContext

const site: SiteFiles = {
  id: "ard",
  hosts: /./u,
  file: /\/fixtures\/ard\.ttml$/u,
  format: "ttml",
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

it("reads a WebVTT file in the language its address names", async () => {
  const files = watchSiteFiles(ctx, {
    ...site,
    file: /_st_VO-ANG_1\.vtt$/u,
    format: "webvtt",
    lang: (url) => (url.includes("VO-ANG") ? "en" : undefined),
  })
  await fetch("/src/entrypoints/content/files/fixtures/dackel_st_VO-ANG_1.vtt")
  await vi.waitFor(() => expect(files.track()).toBeDefined())
  expect(files.track()).toEqual({
    lang: "en",
    cues: [{ startMs: 1000, endMs: 3000, text: "Dachshunds are not only trendy\nin Germany at the moment." }],
    fast: false,
  })
})
