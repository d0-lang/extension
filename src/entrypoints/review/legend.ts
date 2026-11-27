/** The key legend beside the card, and which of its rows and keys a key press lights. */
import type { ReviewAction } from "./keys"
import type { Focus } from "./review.svelte"

type LegendRow = {
  /** Each group does the same, so they are joined with "or". */
  groups: Array<Array<string>>
  action: string
  kinds: Array<ReviewAction["kind"]>
}

export const LEGEND: Array<LegendRow> = [
  {
    groups: [
      ["W", "S"],
      ["K", "J"],
    ],
    action: "Move up and down",
    kinds: ["focus"],
  },
  {
    groups: [
      ["Shift", "W", "S"],
      ["Shift", "K", "J"],
    ],
    action: "Previous or next word",
    kinds: ["word"],
  },
  {
    groups: [
      ["A", "D"],
      ["H", "L"],
    ],
    action: "Another entry of the word",
    kinds: ["entry"],
  },
  { groups: [["Space"], ["Enter"], ["1–9"]], action: "Pick a meaning", kinds: ["activate", "sense"] },
  { groups: [["E"], ["I"]], action: "Edit", kinds: ["edit"] },
  { groups: [["Ctrl", "Enter"]], action: "Send to Anki", kinds: ["send"] },
  { groups: [["X"]], action: "Drop the word", kinds: ["drop"] },
]

/** What Space and Enter do on each selection: send, drop, edit the sentence, or pick the meaning. */
const ACTIVATED: Record<Exclude<Focus, number>, ReviewAction["kind"]> = {
  send: "send",
  drop: "drop",
  sentence: "edit",
}

/**
 * The row of the legend that `action` belongs to, with Space and Enter on the row of what they do on `focus`. Unset
 * for Escape, which has none.
 */
export const legendRow = (action: ReviewAction, focus: Focus): number | undefined => {
  const kind = action.kind === "activate" && typeof focus !== "number" ? ACTIVATED[focus] : action.kind
  const row = LEGEND.findIndex((entry) => entry.kinds.includes(kind))
  return row === -1 ? undefined : row
}

/** The legend's names for the keys `event` presses, modifiers first. Keys the legend does not show, like arrows, have none. */
export const pressedKeys = (event: KeyboardEvent): Array<string> => {
  const modifiers = [
    ...(event.shiftKey ? ["Shift"] : []),
    ...(event.ctrlKey || event.metaKey ? ["Ctrl"] : []),
  ]
  const letter = /^Key([A-Z])$/.exec(event.code)?.[1]
  const key =
    letter ??
    (/^(?:Digit|Numpad)[1-9]$/.test(event.code)
      ? "1–9"
      : event.code === "Space"
        ? "Space"
        : event.code === "Enter" || event.code === "NumpadEnter"
          ? "Enter"
          : undefined)
  return key === undefined ? modifiers : [...modifiers, key]
}

/**
 * Which keys of a row's `group` to light for `pressed`. Only the group with the key itself lights, so Shift + K does
 * not light the Shift beside W.
 */
export const litKeys = (group: Array<string>, pressed: Array<string>): Array<boolean> => {
  const key = pressed.at(-1)
  const lit = key !== undefined && !["Shift", "Ctrl"].includes(key) && group.includes(key)
  return group.map((name) => lit && pressed.includes(name))
}
