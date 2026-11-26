import { afterEach, describe, expect, it, vi } from "vitest"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { DEFAULT_SUBTITLE_SETTINGS } from "$lib/storage"
import type { Shown } from "$lib/subtitles/rows"
import { addCopyMenu } from "./copy"
import type { Host } from "./host"
import { createOverlay } from "./overlay"

/** A player with no bars of its own, and an own menu for the copy menu to hide. */
const HOST: Host = { bars: () => ({ top: 0, bottom: 0 }), ownMenu: ".own-menu" }

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
  settings = DEFAULT_SUBTITLE_SETTINGS,
  lang = "en",
) => {
  const player = document.createElement("div")
  player.className = "html5-video-player"
  player.style.cssText = "position: relative; width: 960px; height: 540px"
  const video = document.createElement("video")
  player.append(video)
  document.body.append(player)
  const overlay = createOverlay(ctx(), player, HOST, () => {}, settings)
  overlay.show(cue, lang)
  addCopyMenu(ctx(), overlay)
  return { player, video, overlay }
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
    expect(items()).toEqual(["Copy “Sure”", "Copy line", "Copy prompt to explain “Sure”"])
    expect(onPlayer).not.toHaveBeenCalled()
  })

  it("draws an icon by each item", () => {
    setUp()
    rightClick(word("Sure"))
    const menuItems = [...document.querySelectorAll("[data-dadict-menu] button")]
    expect(menuItems.map((item) => item.querySelector("svg") !== null)).toEqual([true, true, true])
  })

  it("marks the word the menu is for until it closes", () => {
    setUp()
    rightClick(word("Sure"))
    expect(word("Sure").dataset.picked).toBe("")
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    expect(word("Sure").dataset.picked).toBeUndefined()
  })

  it("leaves a video that was stopped already stopped", () => {
    const { video } = setUp()
    const play = vi.spyOn(video, "play").mockResolvedValue()
    rightClick(word("Sure"))
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    expect(play).not.toHaveBeenCalled()
  })

  it("closes when another line comes, like after a seek", async () => {
    const { overlay } = setUp()
    rightClick(word("Sure"))
    overlay.show({ text: "Anything else?" }, "en")
    await vi.waitFor(() => expect(document.querySelector("[data-dadict-menu]")).toBeNull())
    expect(document.querySelector("[data-picked]")).toBeNull()
  })

  it("hides the player's own menu", () => {
    const { player } = setUp()
    const own = document.createElement("div")
    own.className = "own-menu"
    player.append(own)
    rightClick(word("Sure"))
    expect(own.style.display).toBe("none")
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
    pick("Copy “Sure”")
    await vi.waitFor(() => expect(write).toHaveBeenCalledWith("Sure"))
  })

  it("copies the line clicked on one line, and notes the copy", async () => {
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue()
    setUp({ text: "Pass the\nsalt." })
    rightClick(word("salt"))
    pick("Copy line")
    await vi.waitFor(() => expect(note()).toBe("Copied."))
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
    setUp({ text: "Passe-moi le sel." }, DEFAULT_SUBTITLE_SETTINGS, "fr")
    rightClick(word("sel"))
    pick("Copy prompt to explain “sel”")
    await vi.waitFor(() =>
      expect(write).toHaveBeenCalledWith(
        'Explain the French word "sel" as it is used in this line from a video:\n\n"Passe-moi le sel."',
      ),
    )
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
})
