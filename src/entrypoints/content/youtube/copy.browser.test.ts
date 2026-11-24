import { afterEach, describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { DEFAULT_SUBTITLE_SETTINGS } from "$lib/storage"
import type { Shown } from "$lib/subtitles/rows"
import { addCopyMenu, type SelectTip } from "./copy"
import { createOverlay } from "./overlay"

let controller = new AbortController()

const ctx = () =>
  ({
    signal: controller.signal,
    setTimeout: (handler: () => void, ms: number) => window.setTimeout(handler, ms),
  }) as unknown as ContentScriptContext

afterEach(() => {
  controller.abort()
  controller = new AbortController()
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

/** A player with a video, the overlay in it showing `cue`, and the copy menu on it. */
const setUp = (
  cue: Shown = { text: "Sure.", previous: { text: "Pass the\nsalt." } },
  used = false,
  settings = DEFAULT_SUBTITLE_SETTINGS,
  lang = "en",
) => {
  const player = document.createElement("div")
  player.className = "html5-video-player"
  player.style.cssText = "position: relative; width: 960px; height: 540px"
  const video = document.createElement("video")
  player.append(video)
  document.body.append(player)
  const onWord = vi.fn()
  const overlay = createOverlay(ctx(), player, onWord, settings)
  overlay.show(cue, lang)
  const tip: SelectTip = { used: () => Promise.resolve(used), use: vi.fn() }
  addCopyMenu(ctx(), overlay, tip)
  return { player, video, onWord, tip }
}

const word = (text: string): HTMLElement =>
  [...document.querySelectorAll<HTMLElement>("[data-word]")].find((part) => part.textContent === text)!

const rightClick = (target: HTMLElement) => {
  const { left, top } = target.getBoundingClientRect()
  target.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: left + 2, clientY: top + 2 }),
  )
}

const items = () =>
  [...document.querySelectorAll("[data-dadict-menu] button")].map((item) => item.textContent)

const note = () => document.querySelector("[data-dadict-note]")?.textContent

const pick = (label: string) =>
  [...document.querySelectorAll<HTMLElement>("[data-dadict-menu] button")]
    .find((item) => item.textContent === label)!
    .click()

describe("addCopyMenu", () => {
  it("opens its own menu on a right-click, not the player's", () => {
    const { player } = setUp()
    const onPlayer = vi.fn()
    player.addEventListener("contextmenu", onPlayer)
    rightClick(word("Sure"))
    expect(items()).toEqual(["Copy word", "Copy line", "Copy prompt to explain word"])
    expect(onPlayer).not.toHaveBeenCalled()
  })

  it("offers only the line between words", () => {
    setUp()
    rightClick(document.querySelector<HTMLElement>("[data-cue]:not([data-previous]) [data-line]")!)
    expect(items()).toEqual(["Copy line"])
  })

  it("copies the word right-clicked", async () => {
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue()
    setUp()
    rightClick(word("Sure"))
    pick("Copy word")
    await vi.waitFor(() => expect(write).toHaveBeenCalledWith("Sure"))
  })

  it("copies the line clicked on one line, and tells of selecting with Shift", async () => {
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue()
    setUp({ text: "Pass the\nsalt." })
    rightClick(word("salt"))
    pick("Copy line")
    await vi.waitFor(() => expect(note()).toBe("Copied. Hold Shift and drag to select words."))
    expect(write).toHaveBeenCalledWith("Pass the salt.")
    expect(document.querySelector("[data-dadict-menu]")).toBeNull()
  })

  it("copies the line before when its row is clicked", async () => {
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue()
    setUp({ text: "Sure.", previous: { text: "Pass the salt." } })
    rightClick(word("salt"))
    pick("Copy line")
    await vi.waitFor(() => expect(write).toHaveBeenCalledWith("Pass the salt."))
  })

  it("copies a prompt to explain the word in its line", async () => {
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue()
    setUp({ text: "Passe-moi le sel." }, false, DEFAULT_SUBTITLE_SETTINGS, "fr")
    rightClick(word("sel"))
    pick("Copy prompt to explain word")
    await vi.waitFor(() =>
      expect(write).toHaveBeenCalledWith(
        'Explain the French word "sel" as it is used in this line from a video:\n\n"Passe-moi le sel."',
      ),
    )
  })

  it("only notes the copy once Shift has been used", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue()
    setUp(undefined, true)
    rightClick(word("Sure"))
    pick("Copy line")
    await vi.waitFor(() => expect(note()).toBe("Copied."))
  })
  it("closes on Escape or a press elsewhere", () => {
    const { player } = setUp()
    rightClick(word("Sure"))
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    expect(document.querySelector("[data-dadict-menu]")).toBeNull()
    rightClick(word("Sure"))
    player.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))
    expect(document.querySelector("[data-dadict-menu]")).toBeNull()
  })

  it("selects words with Shift, stopping the video and looking nothing up", () => {
    const { video, onWord, tip } = setUp()
    const pause = vi.spyOn(video, "pause")
    const target = word("Sure")
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, isPrimary: true, shiftKey: true }))
    const select = new Event("selectstart", { bubbles: true, cancelable: true })
    target.dispatchEvent(select)
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }))
    expect(select.defaultPrevented).toBe(false)
    expect(pause).toHaveBeenCalled()
    expect(tip.use).toHaveBeenCalled()
    expect(onWord).not.toHaveBeenCalled()
  })

  it("starts a Shift selection at the press, not at a selection elsewhere on the page", async () => {
    const title = document.createElement("p")
    title.textContent = "This section explains the principle of relay operation."
    document.body.prepend(title)
    getSelection()!.collapse(title.firstChild, 0)
    setUp({ text: "Pass the salt, please." })
    await userEvent.click(word("salt"), { modifiers: ["Shift"] })
    const selection = getSelection()!
    expect(selection.toString()).not.toContain("relay")
    expect(word("salt").contains(selection.anchorNode)).toBe(true)
  })

  it("extends a Shift selection already in the subtitles", async () => {
    setUp({ text: "Pass the salt, please." })
    getSelection()!.collapse(word("Pass").firstChild, 0)
    await userEvent.click(word("salt"), { modifiers: ["Shift"] })
    expect(getSelection()!.toString()).toMatch(/^Pass the s/u)
  })

  it("still keeps a press without Shift from selecting", () => {
    setUp()
    const target = word("Sure")
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, isPrimary: true }))
    const select = new Event("selectstart", { bubbles: true, cancelable: true })
    target.dispatchEvent(select)
    expect(select.defaultPrevented).toBe(true)
  })
})
