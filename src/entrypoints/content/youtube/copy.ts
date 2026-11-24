/** Copying subtitles: a menu on right-click for the word, its line, or a prompt to have a chatbot explain the word. */
import { fromThrowable } from "neverthrow"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { joinLines } from "./cues"
import type { Overlay } from "./overlay"

/** How long the note on a copy stays. */
const NOTE_MS = 2500

/** Kept from the player, which would take them as play, pause, its own menu or a drag. */
const KEPT = [
  "pointerdown",
  "pointerup",
  "mousedown",
  "mouseup",
  "click",
  "dblclick",
  "contextmenu",
  "touchstart",
  "touchend",
]

// The language comes from YouTube's track, which may name one `Intl` does not know.
const languageName = (lang: string): string | undefined =>
  fromThrowable(() => new Intl.DisplayNames(["en"], { type: "language" }).of(lang))().unwrapOr(undefined)

/** A prompt to paste into a chatbot, asking what `word` means in `line`. */
const explainPrompt = (word: string, line: string, lang: string): string => {
  const language = languageName(lang)
  return `Explain the ${language === undefined ? "" : `${language} `}word "${word}" as it is used in this line from a video:\n\n"${line}"`
}

/** A hidden text area the copy command can take the text from. */
const copyCommand = (text: string): boolean => {
  const area = document.createElement("textarea")
  area.value = text
  area.style.cssText = "position: fixed; opacity: 0"
  document.body.append(area)
  area.select()
  const copied = document.execCommand("copy")
  area.remove()
  return copied
}

/** Puts `text` on the clipboard. Players in a frame may not be allowed the clipboard API, so the copy command is tried after. */
const writeText = (text: string): Promise<boolean> =>
  navigator.clipboard.writeText(text).then(
    () => true,
    () => copyCommand(text),
  )

/** Opens a menu for copying the subtitles where they are right-clicked, and notes each copy in the player. */
export const addCopyMenu = (ctx: ContentScriptContext, overlay: Overlay) => {
  const { element: root, player } = overlay
  let menu: HTMLElement | undefined
  let closing: AbortController | undefined
  let note: HTMLElement | undefined

  const keepFromPlayer = (element: HTMLElement) => {
    for (const type of KEPT) {
      element.addEventListener(type, (event) => event.stopPropagation())
    }
  }

  const close = () => {
    closing?.abort()
    closing = undefined
    menu?.remove()
    menu = undefined
  }

  const tell = (text: string) => {
    note?.remove()
    const element = document.createElement("div")
    element.dataset.dadictNote = ""
    element.setAttribute("role", "status")
    element.textContent = text
    player.append(element)
    note = element
    ctx.setTimeout(() => element.remove(), NOTE_MS)
  }

  const copy = async (text: string) => {
    close()
    if (!(await writeText(text))) {
      tell("Could not copy the subtitle.")
      return
    }
    tell("Copied.")
  }

  /** Opens the menu with `items` at `x` and `y` on screen, moved as little as keeps it in the player. */
  const open = (x: number, y: number, items: ReadonlyArray<{ label: string; text: string }>) => {
    close()
    const element = document.createElement("div")
    element.dataset.dadictMenu = ""
    element.setAttribute("role", "menu")
    for (const { label, text } of items) {
      const item = document.createElement("button")
      item.type = "button"
      item.setAttribute("role", "menuitem")
      item.textContent = label
      item.addEventListener("click", () => void copy(text))
      element.append(item)
    }
    keepFromPlayer(element)
    element.addEventListener("contextmenu", (event) => event.preventDefault())
    player.append(element)
    menu = element
    const box = player.getBoundingClientRect()
    const size = element.getBoundingClientRect()
    element.style.left = `${Math.max(0, Math.min(x - box.left, box.width - size.width))}px`
    element.style.top = `${Math.max(0, Math.min(y - box.top, box.height - size.height))}px`
    element.querySelector("button")?.focus()

    closing = new AbortController()
    const signal = AbortSignal.any([closing.signal, ctx.signal])
    window.addEventListener(
      "pointerdown",
      (event) => {
        if (!event.composedPath().includes(element)) {
          close()
        }
      },
      { capture: true, signal },
    )
    window.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") {
          event.stopPropagation()
          close()
        }
      },
      { capture: true, signal },
    )
    window.addEventListener("blur", close, { signal })
  }

  root.addEventListener(
    "contextmenu",
    (event) => {
      const shown = overlay.shown()
      if (shown === undefined) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      const target = event.target instanceof Element ? event.target : null
      const word = target?.closest("[data-word]")?.textContent ?? undefined
      const { cue, lang } = shown
      // The line clicked, which is the one before when it is the row above.
      const clicked =
        target?.closest("[data-previous]") != null && cue.previous !== undefined ? cue.previous : cue
      // YouTube breaks lines to fit its box, so the text goes on one line.
      const line = joinLines(clicked.text)
      open(event.clientX, event.clientY, [
        ...(word === undefined ? [] : [{ label: "Copy word", text: word }]),
        { label: "Copy line", text: line },
        ...(word === undefined
          ? []
          : [{ label: "Copy prompt to explain word", text: explainPrompt(word, line, lang) }]),
      ])
    },
    { signal: ctx.signal },
  )

  return {
    remove: () => {
      close()
      note?.remove()
    },
  }
}
