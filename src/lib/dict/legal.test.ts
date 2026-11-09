import { describe, expect, it } from "vitest"
import { acceptedLegal, changedDocuments, legalChanged } from "./legal"

const hash = (char: string) => char.repeat(64)

const legal = {
  privacy_link: "https://dict.example/privacy",
  privacy_hash: hash("a"),
  tos_link: "https://dict.example/tos",
  tos_hash: hash("b"),
}

const accepted = acceptedLegal(legal)

describe("legalChanged", () => {
  it("is false for the accepted policies, even at a new link", () => {
    expect(legalChanged(accepted, legal)).toBe(false)
    expect(legalChanged(accepted, { ...legal, tos_link: "https://new.example/tos" })).toBe(false)
  })

  it("is true for a new hash", () => {
    expect(legalChanged(accepted, { ...legal, privacy_hash: hash("c") })).toBe(true)
  })

  it("is true when the server adds or drops its policies", () => {
    expect(legalChanged(null, legal)).toBe(true)
    expect(legalChanged(accepted, undefined)).toBe(true)
  })

  it("is false for a testing server that stays one", () => {
    expect(legalChanged(null, undefined)).toBe(false)
  })

  it("is true for records stored before policies were read", () => {
    expect(legalChanged(undefined, legal)).toBe(true)
    expect(legalChanged(undefined, undefined)).toBe(true)
  })
})

describe("changedDocuments", () => {
  it("names each policy with a new hash", () => {
    expect(changedDocuments(accepted, { ...legal, tos_hash: hash("c") })).toEqual(["tos"])
    expect(changedDocuments(accepted, { ...legal, privacy_hash: hash("c"), tos_hash: hash("d") })).toEqual([
      "privacy",
      "tos",
    ])
  })

  it("is empty unless both sides have policies", () => {
    expect(changedDocuments(null, legal)).toEqual([])
    expect(changedDocuments(undefined, legal)).toEqual([])
    expect(changedDocuments(accepted, undefined)).toEqual([])
  })
})
