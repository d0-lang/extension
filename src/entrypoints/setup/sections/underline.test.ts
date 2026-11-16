import { describe, expect, it } from "vitest"
import { firefoxUnderlines } from "./underline"

describe("firefoxUnderlines", () => {
  it("draws from Firefox 146", () => {
    expect(firefoxUnderlines("145.0.1")).toBe(false)
    expect(firefoxUnderlines("146.0")).toBe(true)
    expect(firefoxUnderlines("158.0.1")).toBe(true)
  })

  it("does not draw on a version it cannot read", () => {
    expect(firefoxUnderlines("")).toBe(false)
  })
})
