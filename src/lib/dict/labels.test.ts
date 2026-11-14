import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { BoundServer, LabelsByPair, ServerByLang } from "../storage"
import { refreshLabels } from "./labels"

const stored = vi.hoisted(() => ({
  servers: {} as Record<string, Partial<BoundServer>>,
  serverByLang: {} as ServerByLang,
  serverLabels: {} as Record<string, LabelsByPair>,
}))
vi.mock("../storage", () => ({
  getServers: () => Promise.resolve(stored.servers),
  getServerByLang: () => Promise.resolve(stored.serverByLang),
  setServerLabels: (url: string, labels: LabelsByPair | undefined) => {
    const { [url]: _old, ...rest } = stored.serverLabels
    stored.serverLabels = labels === undefined ? rest : { ...rest, [url]: labels }
    return Promise.resolve()
  },
}))

const URL_ = "https://dict.example"
const KEPT: LabelsByPair = { ru_en: { pf: { name: "perfective" } } }

/** Stands in for `fetch`, answering every request with `respond` and keeping the URLs asked for. */
const serve = (respond: () => Response | Promise<Response>): Array<string> => {
  const asked: Array<string> = []
  vi.stubGlobal("fetch", (input: string) => {
    asked.push(input)
    return Promise.resolve(respond())
  })
  return asked
}

beforeEach(() => {
  stored.servers = {
    [URL_]: { url: URL_, languages: ["ru_en", "de_en", "pl_en"], features: ["labels"] },
    "https://other.example": { url: "https://other.example", languages: ["fi_en"] },
  }
  // pl_en is not in use, fi_en is on another server, and uk_en is no longer offered.
  stored.serverByLang = { ru_en: URL_, de_en: URL_, uk_en: URL_, fi_en: "https://other.example" }
  stored.serverLabels = { [URL_]: KEPT }
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("refreshLabels", () => {
  it("asks for the pairs in use on the server, joined by commas, and keeps what it sends", async () => {
    const asked = serve(() =>
      Response.json({
        labels: {
          ru_en: {
            pf: {
              name: "perfective",
              text: "The action is seen as a whole, usually completed.",
            },
            anim: { name: "animate" },
          },
          de_en: {},
        },
      }),
    )
    expect((await refreshLabels(URL_)).isOk()).toBe(true)
    expect(asked).toEqual([`${URL_}/v1/get-labels?lang=ru_en,de_en`])
    expect(stored.serverLabels[URL_]).toEqual({
      ru_en: {
        pf: { name: "perfective", text: "The action is seen as a whole, usually completed." },
        anim: { name: "animate" },
      },
      de_en: {},
    })
  })

  it("keeps the last copy when the fetch fails or the body is malformed", async () => {
    serve(() => new Response("down", { status: 500 }))
    expect((await refreshLabels(URL_)).isErr()).toBe(true)
    serve(() => Response.json({ labels: "pf" }))
    expect((await refreshLabels(URL_)).isErr()).toBe(true)
    serve(() => new Response("not json"))
    expect((await refreshLabels(URL_)).isErr()).toBe(true)
    serve(() => Promise.reject(new TypeError("offline")))
    expect((await refreshLabels(URL_)).isErr()).toBe(true)
    expect(stored.serverLabels[URL_]).toBe(KEPT)
  })

  it("drops what is over the caps or was not asked for, and keeps the rest", async () => {
    serve(() =>
      Response.json({
        labels: {
          ru_en: {
            pf: { name: "perfective", text: "x".repeat(1001) },
            impf: { name: "x".repeat(61) },
            anim: "animate",
            inan: { name: "inanimate" },
          },
          fi_en: { sg: { name: "singular" } },
          NOT_A_PAIR: { sg: { name: "singular" } },
          de_en: "none",
        },
      }),
    )
    expect((await refreshLabels(URL_)).isOk()).toBe(true)
    expect(stored.serverLabels[URL_]).toEqual({
      ru_en: { pf: { name: "perfective" }, inan: { name: "inanimate" } },
    })
  })

  it("keeps none for a server without the feature, and does not ask it", async () => {
    stored.servers[URL_] = { ...stored.servers[URL_], features: [] }
    const asked = serve(() => Response.json({ labels: {} }))
    expect((await refreshLabels(URL_)).isOk()).toBe(true)
    expect(asked).toEqual([])
    expect(stored.serverLabels[URL_]).toBeUndefined()
  })

  it("does not ask when no pair is in use", async () => {
    stored.serverByLang = {}
    const asked = serve(() => Response.json({ labels: {} }))
    expect((await refreshLabels(URL_)).isOk()).toBe(true)
    expect(asked).toEqual([])
  })
})
