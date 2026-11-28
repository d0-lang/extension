import { okAsync } from "neverthrow"
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

it("reads the whole file once for all of its pieces", async () => {
  const text = vi.fn(() => okAsync("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHola\n"))
  const files = watchSiteFiles(ctx, {
    ...site,
    file: /\/pieces\/es\/s_\d+\.m4s$/u,
    format: "webvtt",
    wholeFile: () => ({ name: "es", text }),
    lang: () => "es",
  })
  await fetch("/pieces/es/s_1.m4s")
  await fetch("/pieces/es/s_2.m4s")
  await vi.waitFor(() => expect(files.track()).toBeDefined())
  expect(files.track()?.cues).toEqual([{ startMs: 1000, endMs: 2000, text: "Hola" }])
  await new Promise((resolve) => setTimeout(resolve, 200))
  expect(text).toHaveBeenCalledOnce()
})

it("reads a file that failed again only when the player asks for it again, not on its own request", async () => {
  const requests = vi.spyOn(window, "fetch")
  const files = watchSiteFiles(ctx, { ...site, file: /\/missing\.ttml$/u })
  const asked = () => requests.mock.calls.filter(([url]) => String(url).endsWith("/missing.ttml")).length
  await fetch("/missing.ttml")
  await vi.waitFor(() => expect(asked()).toBe(2))
  await new Promise((resolve) => setTimeout(resolve, 500))
  expect(asked()).toBe(2)
  await fetch("/missing.ttml")
  await vi.waitFor(() => expect(asked()).toBe(4))
  await new Promise((resolve) => setTimeout(resolve, 500))
  expect(asked()).toBe(4)
  expect(files.track()).toBeUndefined()
  requests.mockRestore()
})

it("reads the file the player asked for last, when it asks for two at once", async () => {
  const requests = vi.spyOn(window, "fetch")
  const files = watchSiteFiles(ctx, { ...site, file: /\/fixtures\/ard\.ttml\?(?:first|second)$/u })
  const asked = (file: string) =>
    requests.mock.calls.filter(([url]) => String(url).endsWith(`?${file}`)).length
  await Promise.all([fetch(`${FIXTURE}?first`), fetch(`${FIXTURE}?second`)])
  await vi.waitFor(() => expect(files.track()).toBeDefined())
  await new Promise((resolve) => setTimeout(resolve, 500))
  expect([asked("first"), asked("second")]).toEqual([2, 2])
  requests.mockRestore()
})
