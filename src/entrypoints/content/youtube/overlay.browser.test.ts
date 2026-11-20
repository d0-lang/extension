import { afterEach, describe, expect, it, vi } from "vitest"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import type { WordHit } from "../page/pick"
import { sentenceAround } from "../page/sentence"
import { createOverlay, removeLeftovers } from "./overlay"

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

let controller = new AbortController()

const ctx = () =>
  ({
    signal: controller.signal,
    setTimeout: (handler: () => void, ms: number) => window.setTimeout(handler, ms),
  }) as unknown as ContentScriptContext

afterEach(() => {
  controller.abort()
  controller = new AbortController()
  document.body.replaceChildren()
})

describe("createOverlay", () => {
  it("shows a cue's two lines together", () => {
    const overlay = createOverlay(ctx(), player(), () => {})
    overlay.show("Eine künstliche Intelligenz\ngerät völlig außer Kontrolle.", "de")
    const top = (text: string) => wordSpan(text).getBoundingClientRect().top
    expect(top("künstliche")).toBe(top("Intelligenz"))
    expect(top("gerät")).toBeGreaterThan(top("Intelligenz"))
  })

  it("reads a word's sentence across both lines", () => {
    let hit: WordHit | undefined
    const overlay = createOverlay(ctx(), player(), (picked) => (hit = picked))
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
    createOverlay(ctx(), box, onWord).show("Mamy gościa.", "pl")
    wordSpan("gościa").click()
    expect(onWord).toHaveBeenCalledOnce()
    expect(onPlayer).not.toHaveBeenCalled()
  })

  it("marks the words a range covers and what is between them", () => {
    const overlay = createOverlay(ctx(), player(), () => {})
    overlay.show("Wir senden heute live.", "de")
    const range = document.createRange()
    range.setStart(wordSpan("senden").firstChild!, 0)
    range.setEnd(wordSpan("heute").firstChild!, 5)
    overlay.mark([range], "tint", true)
    const marked = [...document.querySelectorAll("[data-mark=tint]")].map((part) => part.textContent)
    expect(marked).toEqual(["senden", " ", "heute"])
  })

  it("leaves a word the range only touches", () => {
    const overlay = createOverlay(ctx(), player(), () => {})
    overlay.show("Wir senden heute live.", "de")
    const range = document.createRange()
    // From the end of the word before, which is where the word starts too.
    range.setStart(wordSpan("Wir").firstChild!, 3)
    range.setEnd(wordSpan("senden").firstChild!, 6)
    overlay.mark([range], "tint", true)
    const marked = [...document.querySelectorAll("[data-mark]")].map((part) => part.textContent)
    expect(marked).toEqual(["senden"])
  })

  it("underlines with a highlight", () => {
    const overlay = createOverlay(ctx(), player(), () => {})
    overlay.show("Mamy gościa.", "pl")
    const range = document.createRange()
    range.selectNodeContents(wordSpan("gościa").firstChild!)
    const remove = overlay.mark([range], "underline", true)
    expect([...CSS.highlights.get("dadict-underline-dark")!]).toEqual([range])
    expect(document.querySelector("[data-mark]")).toBeNull()
    remove()
    expect(CSS.highlights.has("dadict-underline-dark")).toBe(false)
  })

  it("takes its mark away when done", () => {
    const overlay = createOverlay(ctx(), player(), () => {})
    overlay.show("Mamy gościa.", "pl")
    const range = document.createRange()
    range.selectNodeContents(wordSpan("gościa").firstChild!)
    overlay.mark([range], "tint", true)()
    expect(document.querySelector("[data-mark]")).toBeNull()
  })

  it("knows which words are under the mark", () => {
    let hit: WordHit | undefined
    const overlay = createOverlay(ctx(), player(), (picked) => (hit = picked))
    overlay.show("Wir senden heute live.", "de")
    const range = document.createRange()
    range.setStart(wordSpan("senden").firstChild!, 0)
    range.setEnd(wordSpan("heute").firstChild!, 5)
    const unmark = overlay.mark([range], "underline", true)
    const clicked = (text: string) => {
      wordSpan(text).click()
      return hit!
    }
    expect(overlay.isMarked(clicked("heute"))).toBe(true)
    expect(overlay.isMarked(clicked("live"))).toBe(false)
    unmark()
    expect(overlay.isMarked(clicked("heute"))).toBe(false)
  })

  it("leaves a mark on an earlier cue out", () => {
    let hit: WordHit | undefined
    const overlay = createOverlay(ctx(), player(), (picked) => (hit = picked))
    overlay.show("Mamy gościa.", "pl")
    const range = document.createRange()
    range.selectNodeContents(wordSpan("gościa").firstChild!)
    overlay.mark([range], "tint", true)
    overlay.show("Mamy gościa!", "pl")
    wordSpan("gościa").click()
    expect(overlay.isMarked(hit!)).toBe(false)
  })

  it("hides until the next cue", () => {
    const overlay = createOverlay(ctx(), player(), () => {})
    overlay.show("Mamy gościa.", "pl")
    overlay.show(undefined, "pl")
    expect(document.querySelector<HTMLElement>("[data-dadict-captions]")?.hidden).toBe(true)
  })
})

describe("dragging", () => {
  /** Presses on `word`, moves the pointer by `dx` and `dy`, and lets go. */
  const drag = (word: HTMLElement, dx: number, dy: number) => {
    const { left, top } = word.getBoundingClientRect()
    const at = (type: string, x: number, y: number) =>
      word.dispatchEvent(
        new PointerEvent(type, { bubbles: true, isPrimary: true, pointerId: 1, clientX: x, clientY: y }),
      )
    at("pointerdown", left + 2, top + 2)
    at("pointermove", left + 2 + dx / 2, top + 2 + dy / 2)
    at("pointermove", left + 2 + dx, top + 2 + dy)
    at("pointerup", left + 2 + dx, top + 2 + dy)
    word.click()
  }

  const captions = () =>
    document.querySelector<HTMLElement>("[data-dadict-captions]")!.getBoundingClientRect()

  it("moves the subtitles, and the press does not look the word up", () => {
    const onWord = vi.fn()
    createOverlay(ctx(), player(), onWord).show("Mamy gościa.", "pl")
    const before = captions()
    drag(wordSpan("gościa"), 100, -200)
    expect(captions().left).toBeCloseTo(before.left + 100, 0)
    expect(captions().top).toBeCloseTo(before.top - 200, 0)
    expect(onWord).not.toHaveBeenCalled()
  })

  it("keeps the subtitles in the player", () => {
    const box = player()
    createOverlay(ctx(), box, () => {}).show("Mamy gościa.", "pl")
    drag(wordSpan("gościa"), 2000, -2000)
    const margin = box.clientHeight * 0.02
    expect(captions().right).toBeCloseTo(box.getBoundingClientRect().right - margin, 0)
    expect(captions().top).toBeCloseTo(box.getBoundingClientRect().top + margin, 0)
  })

  it("leaves a press that barely moves a click on the word", () => {
    const onWord = vi.fn()
    createOverlay(ctx(), player(), onWord).show("Mamy gościa.", "pl")
    drag(wordSpan("gościa"), 2, 1)
    expect(onWord).toHaveBeenCalledOnce()
  })

  it("puts the subtitles back where they start", () => {
    const overlay = createOverlay(ctx(), player(), () => {})
    overlay.show("Mamy gościa.", "pl")
    const before = captions()
    drag(wordSpan("gościa"), 100, -200)
    overlay.resetPosition()
    expect(captions().top).toBeCloseTo(before.top, 0)
    expect(captions().left).toBeCloseTo(before.left, 0)
  })
})

describe("removeLeftovers", () => {
  it("removes an earlier run's overlay and style", () => {
    createOverlay(ctx(), player(), () => {}).show("Mamy gościa.", "pl")
    removeLeftovers()
    expect(document.querySelector("[data-dadict-captions]")).toBeNull()
    expect(document.getElementById("dadict-captions-style")).toBeNull()
  })
})
