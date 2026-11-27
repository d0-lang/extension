import { beforeEach, describe, expect, it, vi } from "vitest"
import { rememberShown } from "./shown"

const setLastLookup = vi.fn(async () => {})
const markLookedUp = vi.fn(async () => {})

vi.mock("$lib/storage", () => ({
  getServerByLang: async () => ({ de_en: "https://dict.example" }),
  setLastLookup: (...args: Array<unknown>) => setLastLookup(...(args as [])),
  markLookedUp: () => markLookedUp(),
}))

beforeEach(() => {
  setLastLookup.mockClear()
  markLookedUp.mockClear()
})

describe("rememberShown", () => {
  it("keeps the word and language against the server bound to it, and ticks off a first lookup", async () => {
    await rememberShown({ type: "lookup:shown", word: "Mutter", lang: "de_en" }, 7)
    expect(setLastLookup).toHaveBeenCalledWith(7, {
      word: "Mutter",
      lang: "de_en",
      server: "https://dict.example",
    })
    expect(markLookedUp).toHaveBeenCalled()
  })

  it("keeps nothing for an unbound language, or without a tab", async () => {
    await rememberShown({ type: "lookup:shown", word: "va", lang: "fr_en" }, 7)
    await rememberShown({ type: "lookup:shown", word: "Mutter", lang: "de_en" }, undefined)
    expect(setLastLookup).not.toHaveBeenCalled()
    expect(markLookedUp).not.toHaveBeenCalled()
  })
})
