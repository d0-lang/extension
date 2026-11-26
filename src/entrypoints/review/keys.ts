/** Review keys, in WASD and in vim's letters alike, by physical key so they stay put on any layout. */

export type ReviewAction =
  | { kind: "word"; step: 1 | -1 }
  | { kind: "focus"; step: 1 | -1 }
  | { kind: "toggle" }
  | { kind: "sense"; index: number }
  | { kind: "edit" }
  | { kind: "send" }
  | { kind: "drop" }
  | { kind: "cancel" }

/** With Shift held: the words. */
const SHIFTED: Record<string, ReviewAction> = {
  KeyW: { kind: "word", step: -1 },
  KeyK: { kind: "word", step: -1 },
  ArrowUp: { kind: "word", step: -1 },
  KeyS: { kind: "word", step: 1 },
  KeyJ: { kind: "word", step: 1 },
  ArrowDown: { kind: "word", step: 1 },
}

/** Without modifiers: the sentence and the meanings of the word shown. */
const PLAIN: Record<string, ReviewAction> = {
  KeyA: { kind: "focus", step: -1 },
  KeyH: { kind: "focus", step: -1 },
  ArrowUp: { kind: "focus", step: -1 },
  KeyD: { kind: "focus", step: 1 },
  KeyL: { kind: "focus", step: 1 },
  ArrowDown: { kind: "focus", step: 1 },
  Space: { kind: "toggle" },
  KeyE: { kind: "edit" },
  KeyI: { kind: "edit" },
  KeyX: { kind: "drop" },
  Delete: { kind: "drop" },
  Escape: { kind: "cancel" },
}

const isSend = (event: KeyboardEvent): boolean =>
  (event.ctrlKey || event.metaKey) && (event.code === "Enter" || event.code === "NumpadEnter")

/** What `event` does on the review page outside a text field. Unset for keys it leaves to the browser. */
export const reviewAction = (event: KeyboardEvent): ReviewAction | undefined => {
  if (isSend(event)) {
    return { kind: "send" }
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return undefined
  }
  if (event.shiftKey) {
    return Object.hasOwn(SHIFTED, event.code) ? SHIFTED[event.code] : undefined
  }
  // 1 to 9 pick the meaning with that number.
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(event.code)?.[1]
  if (digit !== undefined) {
    return { kind: "sense", index: Number(digit) - 1 }
  }
  return Object.hasOwn(PLAIN, event.code) ? PLAIN[event.code] : undefined
}

/**
 * What `event` does in a text field being edited: Enter keeps the edit, Escape drops it, and Ctrl + Enter keeps it
 * and sends the card. Unset for typing.
 */
export const fieldAction = (event: KeyboardEvent): "keep" | "cancel" | "send" | undefined => {
  if (isSend(event)) {
    return "send"
  }
  if (event.isComposing || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
    return undefined
  }
  return event.key === "Enter" ? "keep" : event.key === "Escape" ? "cancel" : undefined
}
