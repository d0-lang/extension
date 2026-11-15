import { okAsync } from "neverthrow"
import { describe, expect, it, vi } from "vitest"
import { answer, lastLookupOf } from "./lookup"

const setLastLookup = vi.fn(async () => {})

vi.mock("$lib/storage", () => ({
  isSiteBlocked: async () => false,
  setLastLookup: (...args: Array<unknown>) => setLastLookup(...(args as [])),
}))

vi.mock("$lib/dict", () => ({
  boundLanguages: () => okAsync({ languages: ["de_en"], paused: [] }),
  rankLanguages: (languages: Array<string>) => languages,
  lookupWord: () =>
    okAsync({
      lang: "de_en",
      server: "https://dict.example",
      sources: [],
      labels: {},
      entries: [{ lemma: "Mutter", pos: "NOUN", senses: [{ glosses: ["mother"] }] }],
    }),
}))

describe("lastLookupOf", () => {
  it("is unset when no server answered", () => {
    expect(lastLookupOf("Mutter", { lang: undefined, server: undefined })).toBeUndefined()
  })
})

describe("answer", () => {
  it("keeps the word, language and server, never the sentence or the page", async () => {
    await answer(
      {
        type: "lookup:request",
        word: "Mutter",
        hints: { pinned: undefined, detected: ["de"], lastWorked: undefined },
        context: { text: "Meine Mutter kocht.", at: 6 },
      },
      "https://mail.example/inbox/42",
      7,
    )
    expect(setLastLookup).toHaveBeenCalledTimes(1)
    expect(setLastLookup).toHaveBeenCalledWith(7, {
      word: "Mutter",
      lang: "de_en",
      server: "https://dict.example",
    })
  })
})
