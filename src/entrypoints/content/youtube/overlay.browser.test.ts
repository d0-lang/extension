import { afterEach, describe, expect, it, vi } from "vitest"
import type { WordHit } from "../page/pick"
import { sentenceAround } from "../page/sentence"
import { createOverlay } from "./overlay"

/** Stands in for YouTube's player: a positioned box the overlay goes into. */
const player = () => {
  const element = document.createElement("div")
  element.className = "html5-video-player"
  element.style.cssText = "position: relative; width: 960px; height: 540px"
  document.body.append(element)
  return element
}

const wordSpan = (text: string): HTMLElement =>
  [...document.querySelectorAll<HTMLElement>("[data-word]")].find((word) => word.textContent === text)!

afterEach(() => {
  document.body.replaceChildren()
})

describe("createOverlay", () => {
  it("shows a cue's two lines together", () => {
    const overlay = createOverlay(player(), () => {})
    overlay.show("Eine künstliche Intelligenz\ngerät völlig außer Kontrolle.", "de")
    const top = (text: string) => wordSpan(text).getBoundingClientRect().top
    expect(top("künstliche")).toBe(top("Intelligenz"))
    expect(top("gerät")).toBeGreaterThan(top("Intelligenz"))
  })

  it("reads a word's sentence across both lines", () => {
    let hit: WordHit | undefined
    const overlay = createOverlay(player(), (picked) => (hit = picked))
    overlay.show("Eine künstliche Intelligenz\ngerät völlig außer Kontrolle.", "de")
    wordSpan("künstliche").click()
    expect(hit?.word).toBe("künstliche")
    expect(sentenceAround(hit!.range, hit!.word, "de")?.text).toBe(
      "Eine künstliche Intelligenz gerät völlig außer Kontrolle.",
    )
  })

  it("keeps a click on a word from the player", () => {
    const box = player()
    const onPlayer = vi.fn()
    box.addEventListener("click", onPlayer)
    const onWord = vi.fn()
    createOverlay(box, onWord).show("Mamy gościa.", "pl")
    wordSpan("gościa").click()
    expect(onWord).toHaveBeenCalledOnce()
    expect(onPlayer).not.toHaveBeenCalled()
  })

  it("marks the words a range covers and what is between them", () => {
    const overlay = createOverlay(player(), () => {})
    overlay.show("Wir senden heute live.", "de")
    const range = document.createRange()
    range.setStart(wordSpan("senden").firstChild!, 0)
    range.setEnd(wordSpan("heute").firstChild!, 5)
    overlay.mark([range], "tint", true)
    const marked = [...document.querySelectorAll("[data-mark=tint]")].map((part) => part.textContent)
    expect(marked).toEqual(["senden", " ", "heute"])
  })

  it("leaves a word the range only touches", () => {
    const overlay = createOverlay(player(), () => {})
    overlay.show("Wir senden heute live.", "de")
    const range = document.createRange()
    // From the end of the word before, which is where the word starts too.
    range.setStart(wordSpan("Wir").firstChild!, 3)
    range.setEnd(wordSpan("senden").firstChild!, 6)
    overlay.mark([range], "underline", true)
    const marked = [...document.querySelectorAll("[data-mark]")].map((part) => part.textContent)
    expect(marked).toEqual(["senden"])
  })

  it("takes its mark away when done", () => {
    const overlay = createOverlay(player(), () => {})
    overlay.show("Mamy gościa.", "pl")
    const range = document.createRange()
    range.selectNodeContents(wordSpan("gościa").firstChild!)
    overlay.mark([range], "tint", true)()
    expect(document.querySelector("[data-mark]")).toBeNull()
  })

  it("hides until the next cue", () => {
    const overlay = createOverlay(player(), () => {})
    overlay.show("Mamy gościa.", "pl")
    overlay.show(undefined, "pl")
    expect(document.querySelector<HTMLElement>("[data-dadict-captions]")?.hidden).toBe(true)
  })
})
