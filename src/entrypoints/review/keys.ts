/** Review keys, in WASD and in vim's letters alike, by physical key so they stay put on any layout. */

export type ReviewAction =
  | { kind: "focus"; step: 1 | -1 }
  | { kind: "toggle" }
  | { kind: "sense"; index: number }
  | { kind: "word"; step: 1 | -1 }
  | { kind: "send" }
  | { kind: "drop" }

const ACTIONS: Record<string, ReviewAction> = {
  KeyW: { kind: "focus", step: -1 },
  KeyK: { kind: "focus", step: -1 },
  ArrowUp: { kind: "focus", step: -1 },
  KeyS: { kind: "focus", step: 1 },
  KeyJ: { kind: "focus", step: 1 },
  ArrowDown: { kind: "focus", step: 1 },
  KeyA: { kind: "word", step: -1 },
  KeyH: { kind: "word", step: -1 },
  ArrowLeft: { kind: "word", step: -1 },
  KeyD: { kind: "word", step: 1 },
  KeyL: { kind: "word", step: 1 },
  ArrowRight: { kind: "word", step: 1 },
  Space: { kind: "toggle" },
  Enter: { kind: "send" },
  NumpadEnter: { kind: "send" },
  KeyX: { kind: "drop" },
  Delete: { kind: "drop" },
}

/** What `event` does on the review page. Unset for keys it leaves alone, and while a modifier is held. */
export const reviewAction = (event: KeyboardEvent): ReviewAction | undefined => {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return undefined
  }
  // 1 to 9 pick the sense with that number.
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(event.code)?.[1]
  if (digit !== undefined) {
    return { kind: "sense", index: Number(digit) - 1 }
  }
  return Object.hasOwn(ACTIONS, event.code) ? ACTIONS[event.code] : undefined
}
