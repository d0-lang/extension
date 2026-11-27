import { describe, expect, it } from "vitest"
import { sectionGroups, sectionOf } from "./sections"

describe("sectionOf", () => {
  it("reads the section from the hash", () => {
    expect(sectionOf("#appearance")).toBe("appearance")
  })

  it("is unset without a hash, or for one that names no section", () => {
    expect(sectionOf("")).toBeUndefined()
    expect(sectionOf("#")).toBeUndefined()
    expect(sectionOf("#lookup")).toBeUndefined()
  })
})

describe("sectionGroups", () => {
  it("keeps sections in order under their group", () => {
    expect(
      sectionGroups().map(({ group, sections }) => [group, sections.map((section) => section.id)]),
    ).toEqual([
      ["Welcome", ["start"]],
      ["Dictionaries", ["servers"]],
      ["Sites", ["integrations", "sites"]],
      ["Display", ["appearance", "subtitles", "hotkeys"]],
      ["Flashcards", ["anki"]],
    ])
  })

  it("leaves out hidden sections, and a group left empty", () => {
    expect(sectionGroups(["start"]).map(({ group }) => group)).toEqual([
      "Dictionaries",
      "Sites",
      "Display",
      "Flashcards",
    ])
  })
})
