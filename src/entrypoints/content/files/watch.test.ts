import { describe, expect, it } from "vitest"
import { isNewRequest } from "./watch"

describe("isNewRequest", () => {
  const latest = { url: "b.xml", start: 200, failed: false }

  it("reads the first request, and a later one for another file", () => {
    expect(isNewRequest(undefined, "a.xml", 100)).toBe(true)
    expect(isNewRequest(latest, "c.xml", 300)).toBe(true)
  })

  it("skips a request that started before the latest, though it was reported after it", () => {
    expect(isNewRequest(latest, "a.xml", 100)).toBe(false)
  })

  it("skips asking again for the file it read, unless reading it failed", () => {
    expect(isNewRequest(latest, "b.xml", 300)).toBe(false)
    expect(isNewRequest({ ...latest, failed: true }, "b.xml", 300)).toBe(true)
  })
})
