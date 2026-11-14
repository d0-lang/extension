import { afterEach, describe, expect, it, vi } from "vitest"
import { lookup } from "./api"

const URL_ = "https://dict.example"

/** Stands in for `fetch`, answering every request with `respond` and keeping what was asked. */
const serve = (respond: () => Response): Array<{ url: string; init: RequestInit | undefined }> => {
  const asked: Array<{ url: string; init: RequestInit | undefined }> = []
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
    asked.push({ url, init })
    return Promise.resolve(respond())
  })
  return asked
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("lookup", () => {
  it("posts the word in the body and keeps it out of the URL", async () => {
    const asked = serve(() => Response.json({ entries: [] }))
    const result = await lookup(URL_, "Mutter & Vater", "de_en", undefined)

    expect(result.isOk()).toBe(true)
    expect(asked).toHaveLength(1)
    expect(asked[0]!.url).toBe(`${URL_}/v1/lookup`)
    expect(asked[0]!.init?.method).toBe("POST")
    expect(new Headers(asked[0]!.init?.headers).get("content-type")).toBe("application/json")
    expect(JSON.parse(asked[0]!.init?.body as string)).toEqual({ word: "Mutter & Vater", lang: "de_en" })
  })

  it("sends the sentence, and the clicked copy as a number", async () => {
    const asked = serve(() => Response.json({ entries: [] }))
    await lookup(URL_, "восток", "ru_en", { text: "С востока на восток.", at: 2 })
    await lookup(URL_, "восток", "ru_en", { text: "На восток.", at: undefined })

    expect(asked.map(({ url }) => url)).toEqual([`${URL_}/v1/lookup`, `${URL_}/v1/lookup`])
    expect(JSON.parse(asked[0]!.init?.body as string)).toEqual({
      word: "восток",
      lang: "ru_en",
      context: "С востока на восток.",
      at: 2,
    })
    expect(JSON.parse(asked[1]!.init?.body as string)).toEqual({
      word: "восток",
      lang: "ru_en",
      context: "На восток.",
    })
  })

  it("names the server's rejection", async () => {
    serve(() => Response.json({ error: "unsupported_lang" }, { status: 400 }))
    const result = await lookup(URL_, "Mutter", "xx_en", undefined)

    expect(result.isErr() && result.error.kind).toBe("unsupported-lang")
  })
})
