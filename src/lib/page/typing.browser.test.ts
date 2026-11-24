import { afterEach, describe, expect, it } from "vitest"
import { isTyping } from "./hold"

afterEach(() => {
  document.body.replaceChildren()
})

/** Focuses the first element of `html`. */
const focus = (html: string) => {
  document.body.innerHTML = html
  ;(document.body.firstElementChild as HTMLElement).focus()
}

describe("isTyping", () => {
  it("is typing in a text field, a text area or editable text", () => {
    for (const html of [
      "<input>",
      "<input type=search>",
      "<textarea></textarea>",
      "<div contenteditable>x</div>",
    ]) {
      focus(html)
      expect(isTyping()).toBe(true)
    }
  })

  it("is not typing on a slider, a file picker or a checkbox", () => {
    for (const html of ["<input type=range>", "<input type=file>", "<input type=checkbox>"]) {
      focus(html)
      expect(isTyping()).toBe(false)
    }
  })
})
