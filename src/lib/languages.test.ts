import { describe, expect, it } from "vitest"
import { shortNames } from "./languages"

describe("shortNames", () => {
  it("names a pair by its source language", () => {
    expect([...shortNames(["de_en", "ja_en"]).values()]).toEqual(["de", "ja"])
  })

  it("names a pair into its own language by its source too", () => {
    expect([...shortNames(["de_en", "en_en"]).values()]).toEqual(["de", "en"])
  })

  it("adds the target to pairs that share a source", () => {
    expect([...shortNames(["de_en", "de_de", "ja_en"]).values()]).toEqual(["de→en", "de→de", "ja"])
  })
})
