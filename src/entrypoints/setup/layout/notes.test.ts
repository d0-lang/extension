import { describe, expect, it } from "vitest"
import { blockedNote, serversNote } from "./notes"

describe("serversNote", () => {
  it("says nothing while every server is fine", () => {
    expect(serversNote(2, 0)).toBeUndefined()
  })

  it("counts the servers that need review", () => {
    expect(serversNote(2, 1)).toBe("1 of 2 needs review")
    expect(serversNote(3, 2)).toBe("2 of 3 need review")
  })

  it("leaves out the count with one server", () => {
    expect(serversNote(1, 1)).toBe("Needs review")
  })
})

describe("blockedNote", () => {
  it("counts blocked sites, and says nothing without any", () => {
    expect(blockedNote(0)).toBeUndefined()
    expect(blockedNote(1)).toBe("1 site")
    expect(blockedNote(3)).toBe("3 sites")
  })
})
