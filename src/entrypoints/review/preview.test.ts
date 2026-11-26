import { describe, expect, it } from "vitest"
import { renderTemplate } from "./preview"

describe("renderTemplate", () => {
  it("fills fields, and shows a section by whether its field has text", () => {
    const template = "{{#Sentence}}<p>{{Sentence}}</p>{{/Sentence}}{{^Sentence}}<p>{{Word}}</p>{{/Sentence}}"
    expect(renderTemplate(template, { Sentence: "Er <b>kam</b>.", Word: "kommen" })).toBe(
      "<p>Er <b>kam</b>.</p>",
    )
    expect(renderTemplate(template, { Sentence: "", Word: "kommen" })).toBe("<p>kommen</p>")
  })

  it("takes field names with spaces, and leaves unknown ones empty", () => {
    expect(renderTemplate("{{Part of speech}}|{{constructor}}", { "Part of speech": "verb" })).toBe("verb|")
  })
})
