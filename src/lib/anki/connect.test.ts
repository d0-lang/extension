import { afterEach, describe, expect, it, vi } from "vitest"
import { deckNames, requestPermission } from "./connect"

const TARGET = { url: "http://127.0.0.1:8765", key: undefined }

/** Stands in for `fetch`, answering every request with `respond` and keeping the bodies sent. */
const serve = (respond: () => Response): Array<unknown> => {
  const sent: Array<unknown> = []
  vi.stubGlobal("fetch", (_url: string, init?: RequestInit) => {
    sent.push(JSON.parse(init?.body as string))
    return Promise.resolve(respond())
  })
  return sent
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("invoke", () => {
  it("sends the action with version 6, and the key only when there is one", async () => {
    const sent = serve(() => Response.json({ result: ["Default"], error: null }))
    const decks = await deckNames(TARGET)
    await deckNames({ ...TARGET, key: "secret" })

    expect(decks._unsafeUnwrap()).toEqual(["Default"])
    expect(sent).toEqual([
      { action: "deckNames", version: 6 },
      { action: "deckNames", version: 6, key: "secret" },
    ])
  })

  it("tells a missing key, a refused browser and Anki being closed apart", async () => {
    serve(() => Response.json({ result: null, error: "valid api key must be provided" }))
    expect((await deckNames(TARGET))._unsafeUnwrapErr().kind).toBe("key")

    serve(() => new Response(null, { status: 403 }))
    expect((await deckNames(TARGET))._unsafeUnwrapErr().kind).toBe("denied")

    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")))
    expect((await deckNames(TARGET))._unsafeUnwrapErr().kind).toBe("offline")
  })

  it("rejects a result of the wrong shape", async () => {
    serve(() => Response.json({ result: [1, 2], error: null }))
    expect((await deckNames(TARGET))._unsafeUnwrapErr().kind).toBe("body")
  })
})

describe("requestPermission", () => {
  it("says whether a key is needed, and errs when Anki says no", async () => {
    serve(() => Response.json({ result: { permission: "granted", requireApikey: true }, error: null }))
    expect((await requestPermission(TARGET.url))._unsafeUnwrap()).toEqual({ needsKey: true })

    serve(() => Response.json({ result: { permission: "denied" }, error: null }))
    expect((await requestPermission(TARGET.url))._unsafeUnwrapErr().kind).toBe("denied")
  })
})
