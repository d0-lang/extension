import { afterEach, describe, expect, it, vi } from "vitest"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { DEFAULT_SUBTITLE_SETTINGS } from "$lib/storage"
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

const SETTINGS = DEFAULT_SUBTITLE_SETTINGS

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
    const overlay = createOverlay(ctx(), player(), () => {}, SETTINGS)
    overlay.show({ text: "Eine künstliche Intelligenz\ngerät völlig außer Kontrolle." }, "de")
    const top = (text: string) => wordSpan(text).getBoundingClientRect().top
    expect(top("künstliche")).toBe(top("Intelligenz"))
    expect(top("gerät")).toBeGreaterThan(top("Intelligenz"))
  })

  it("reads a word's sentence across both lines", () => {
    let hit: WordHit | undefined
    const overlay = createOverlay(ctx(), player(), (picked) => (hit = picked), SETTINGS)
    overlay.show({ text: "Eine künstliche Intelligenz\ngerät völlig außer Kontrolle." }, "de")
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
    createOverlay(ctx(), box, onWord, SETTINGS).show({ text: "Mamy gościa." }, "pl")
    wordSpan("gościa").click()
    expect(onWord).toHaveBeenCalledOnce()
    expect(onPlayer).not.toHaveBeenCalled()
  })

  it("marks the words a range covers and what is between them", () => {
    const overlay = createOverlay(ctx(), player(), () => {}, SETTINGS)
    overlay.show({ text: "Wir senden heute live." }, "de")
    const range = document.createRange()
    range.setStart(wordSpan("senden").firstChild!, 0)
    range.setEnd(wordSpan("heute").firstChild!, 5)
    overlay.mark([range], "tint", true)
    const marked = [...document.querySelectorAll("[data-mark=tint]")].map((part) => part.textContent)
    expect(marked).toEqual(["senden", " ", "heute"])
  })

  it("leaves a word the range only touches", () => {
    const overlay = createOverlay(ctx(), player(), () => {}, SETTINGS)
    overlay.show({ text: "Wir senden heute live." }, "de")
    const range = document.createRange()
    // From the end of the word before, which is where the word starts too.
    range.setStart(wordSpan("Wir").firstChild!, 3)
    range.setEnd(wordSpan("senden").firstChild!, 6)
    overlay.mark([range], "tint", true)
    const marked = [...document.querySelectorAll("[data-mark]")].map((part) => part.textContent)
    expect(marked).toEqual(["senden"])
  })

  it("underlines with a highlight", () => {
    const overlay = createOverlay(ctx(), player(), () => {}, SETTINGS)
    overlay.show({ text: "Mamy gościa." }, "pl")
    const range = document.createRange()
    range.selectNodeContents(wordSpan("gościa").firstChild!)
    const remove = overlay.mark([range], "underline", true)
    expect([...CSS.highlights.get("dadict-underline-dark")!]).toEqual([range])
    expect(document.querySelector("[data-mark]")).toBeNull()
    remove()
    expect(CSS.highlights.has("dadict-underline-dark")).toBe(false)
  })

  it("takes its mark away when done", () => {
    const overlay = createOverlay(ctx(), player(), () => {}, SETTINGS)
    overlay.show({ text: "Mamy gościa." }, "pl")
    const range = document.createRange()
    range.selectNodeContents(wordSpan("gościa").firstChild!)
    overlay.mark([range], "tint", true)()
    expect(document.querySelector("[data-mark]")).toBeNull()
  })

  it("knows which words are under the mark", () => {
    let hit: WordHit | undefined
    const overlay = createOverlay(ctx(), player(), (picked) => (hit = picked), SETTINGS)
    overlay.show({ text: "Wir senden heute live." }, "de")
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
    const overlay = createOverlay(ctx(), player(), (picked) => (hit = picked), SETTINGS)
    overlay.show({ text: "Mamy gościa." }, "pl")
    const range = document.createRange()
    range.selectNodeContents(wordSpan("gościa").firstChild!)
    overlay.mark([range], "tint", true)
    overlay.show({ text: "Mamy gościa!" }, "pl")
    wordSpan("gościa").click()
    expect(overlay.isMarked(hit!)).toBe(false)
  })

  it("shows the row the cue before ended on above", () => {
    const overlay = createOverlay(ctx(), player(), () => {}, SETTINGS)
    overlay.show({ text: "Ala ma kota.", previous: { text: "Wczoraj padało\ncały dzień." } }, "pl")
    const top = (text: string) => wordSpan(text).getBoundingClientRect().top
    expect(wordSpan("Wczoraj").getClientRects()).toHaveLength(0)
    expect(top("cały")).toBe(top("dzień"))
    expect(top("dzień")).toBeLessThan(top("kota"))
  })

  it("slides the cue that ended up, keeping its words", () => {
    const overlay = createOverlay(ctx(), player(), () => {}, SETTINGS)
    overlay.show({ text: "Mamy gościa." }, "pl")
    const word = wordSpan("gościa")
    const range = document.createRange()
    range.selectNodeContents(word.firstChild!)
    overlay.show({ text: "Wir senden heute.", previous: { text: "Mamy gościa." } }, "de")
    overlay.show({ text: "Wir senden heute live.", previous: { text: "Wir senden heute." } }, "de")
    overlay.show({ text: "Nie wiem.", previous: { text: "Mamy gościa." } }, "pl")
    expect(wordSpan("gościa")).not.toBe(word)
    overlay.show({ text: "Wir senden heute.", previous: { text: "Nie wiem." } }, "de")
    const ended = wordSpan("heute")
    range.selectNodeContents(ended.firstChild!)
    overlay.show({ text: "Ala ma kota.", previous: { text: "Wir senden heute." } }, "de")
    expect(wordSpan("heute")).toBe(ended)
    expect(range.collapsed).toBe(false)
    expect(ended.closest("[data-previous]")).not.toBeNull()
    expect(document.querySelectorAll("[data-previous]")).toHaveLength(1)
  })

  it("keeps the row a long cue ended on as it showed", () => {
    const overlay = createOverlay(ctx(), player(), () => {}, SETTINGS)
    const long = Array.from({ length: 30 }, (_, index) => `słowo${index}`).join(" ")
    overlay.show({ text: long }, "pl")
    const row = (word: HTMLElement) => word.getBoundingClientRect().top
    const words = Array.from({ length: 30 }, (_, index) => wordSpan(`słowo${index}`))
    const lastRow = words.filter((word) => row(word) === row(words.at(-1)!))
    expect(lastRow.length).toBeLessThan(words.length)
    const lefts = lastRow.map((word) => word.getBoundingClientRect().left)
    overlay.show({ text: "Ala ma kota.", previous: { text: long } }, "pl")
    expect(lastRow.map((word) => word.getBoundingClientRect().left)).toEqual(lefts)
    expect(new Set(lastRow.map(row)).size).toBe(1)
    expect(words.filter((word) => word.getClientRects().length > 0)).toEqual(lastRow)
  })

  it("reads a word's sentence across the cue before", () => {
    let hit: WordHit | undefined
    const overlay = createOverlay(ctx(), player(), (picked) => (hit = picked), SETTINGS)
    overlay.show(
      { text: "gerät völlig außer Kontrolle.", previous: { text: "Eine künstliche Intelligenz" } },
      "de",
    )
    wordSpan("gerät").click()
    expect(sentenceAround(hit!.range, hit!.word, "de")?.text).toBe(
      "Eine künstliche Intelligenz gerät völlig außer Kontrolle.",
    )
  })

  it("leaves the cue before out when told to", () => {
    const overlay = createOverlay(ctx(), player(), () => {}, { ...SETTINGS, previous: false })
    overlay.show({ text: "Mamy gościa." }, "pl")
    overlay.show({ text: "Ala ma kota.", previous: { text: "Mamy gościa." } }, "pl")
    expect(document.querySelector("[data-previous]")).toBeNull()
    expect(wordSpan("gościa")).toBeUndefined()
  })

  it("starts at the top when told to", () => {
    const box = player()
    createOverlay(ctx(), box, () => {}, { ...SETTINGS, position: "top" }).show({ text: "Mamy gościa." }, "pl")
    const { top } = document.querySelector("[data-dadict-captions]")!.getBoundingClientRect()
    expect(top - box.getBoundingClientRect().top).toBeLessThan(box.clientHeight / 4)
  })

  it("puts a cue where its creator did", () => {
    const box = player()
    const overlay = createOverlay(ctx(), box, () => {}, SETTINGS)
    overlay.show({ text: "Mamy gościa.", place: { anchor: 4, x: 50, y: 50 } }, "pl")
    const caption = document.querySelector("[data-dadict-captions]")!.getBoundingClientRect()
    const frame = box.getBoundingClientRect()
    expect((caption.top + caption.bottom) / 2).toBeCloseTo((frame.top + frame.bottom) / 2, 0)
    expect((caption.left + caption.right) / 2).toBeCloseTo((frame.left + frame.right) / 2, 0)
  })

  it("keeps a cue its creator put at the edge inside the player", () => {
    const box = player()
    createOverlay(ctx(), box, () => {}, SETTINGS).show(
      { text: "Mamy gościa.", place: { anchor: 0, x: 100, y: 100 } },
      "pl",
    )
    const caption = document.querySelector("[data-dadict-captions]")!.getBoundingClientRect()
    expect(caption.right).toBeLessThanOrEqual(box.getBoundingClientRect().right)
    expect(caption.bottom).toBeLessThanOrEqual(box.getBoundingClientRect().bottom)
  })

  it("draws a creator's colours, italics and bold", () => {
    createOverlay(ctx(), player(), () => {}, SETTINGS).show(
      {
        text: "Pass the salt.\nSure.",
        styles: [
          { color: "#ffff00", from: 0, to: 14 },
          { italic: true, bold: true, from: 15, to: 20 },
        ],
      },
      "en",
    )
    expect(getComputedStyle(wordSpan("salt")).color).toBe("rgb(255, 255, 0)")
    expect(getComputedStyle(wordSpan("Sure")).fontStyle).toBe("italic")
    expect(getComputedStyle(wordSpan("Sure")).fontWeight).toBe("700")
  })

  it("hides until the next cue", () => {
    const overlay = createOverlay(ctx(), player(), () => {}, SETTINGS)
    overlay.show({ text: "Mamy gościa." }, "pl")
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
    createOverlay(ctx(), player(), onWord, SETTINGS).show({ text: "Mamy gościa." }, "pl")
    const before = captions()
    drag(wordSpan("gościa"), 100, -200)
    expect(captions().left).toBeCloseTo(before.left + 100, 0)
    expect(captions().top).toBeCloseTo(before.top - 200, 0)
    expect(onWord).not.toHaveBeenCalled()
  })

  it("keeps the subtitles in the player", () => {
    const box = player()
    createOverlay(ctx(), box, () => {}, SETTINGS).show({ text: "Mamy gościa." }, "pl")
    drag(wordSpan("gościa"), 2000, -2000)
    const margin = box.clientHeight * 0.02
    expect(captions().right).toBeCloseTo(box.getBoundingClientRect().right - margin, 0)
    expect(captions().top).toBeCloseTo(box.getBoundingClientRect().top + margin, 0)
  })

  it("leaves a press that barely moves a click on the word", () => {
    const onWord = vi.fn()
    createOverlay(ctx(), player(), onWord, SETTINGS).show({ text: "Mamy gościa." }, "pl")
    drag(wordSpan("gościa"), 2, 1)
    expect(onWord).toHaveBeenCalledOnce()
  })

  it("puts the subtitles back where they start", () => {
    const overlay = createOverlay(ctx(), player(), () => {}, SETTINGS)
    overlay.show({ text: "Mamy gościa." }, "pl")
    const before = captions()
    drag(wordSpan("gościa"), 100, -200)
    overlay.resetPosition()
    expect(captions().top).toBeCloseTo(before.top, 0)
    expect(captions().left).toBeCloseTo(before.left, 0)
  })
})

describe("removeLeftovers", () => {
  it("removes an earlier run's overlay and style", () => {
    createOverlay(ctx(), player(), () => {}, SETTINGS).show({ text: "Mamy gościa." }, "pl")
    removeLeftovers()
    expect(document.querySelector("[data-dadict-captions]")).toBeNull()
    expect(document.getElementById("dadict-captions-style")).toBeNull()
  })
})
