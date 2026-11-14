import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchAudio } from "./audio"

vi.mock("$lib/storage", () => ({
  getServers: async () => ({ "https://dict.example.org": {} }),
}))

const fetched = vi.fn<typeof fetch>()

describe("fetchAudio", () => {
  beforeEach(() => {
    fetched.mockReset()
    fetched.mockImplementation(async () => new Response(new Uint8Array([1, 2, 255])))
    vi.stubGlobal("fetch", fetched)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("fetches from Wikimedia and bound servers without a referrer or cookies", async () => {
    for (const url of ["https://upload.wikimedia.org/a.ogg", "https://dict.example.org/audio/a.mp3"]) {
      expect(await fetchAudio(url)).toEqual({ ok: true, data: "AQL/" })
    }
    for (const [, init] of fetched.mock.calls) {
      expect(init).toMatchObject({ credentials: "omit", referrerPolicy: "no-referrer", redirect: "error" })
    }
  })

  it("refuses other hosts and plain http without a request", async () => {
    for (const url of ["https://tracker.example.com/a.ogg", "http://upload.wikimedia.org/a.ogg"]) {
      expect(await fetchAudio(url)).toMatchObject({ ok: false, error: { kind: "audio-host" } })
    }
    expect(fetched).not.toHaveBeenCalled()
  })

  it("refuses a file far larger than a spoken word", async () => {
    fetched.mockResolvedValue(new Response(new Uint8Array(6_000_000)))
    expect(await fetchAudio("https://upload.wikimedia.org/a.ogg")).toMatchObject({
      ok: false,
      error: { kind: "body" },
    })
  })
})
