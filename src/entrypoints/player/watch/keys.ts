/** The player's keys, like a video site's. */

export type PlayerAction = "toggle" | "back" | "forward" | "fullscreen" | "mute"

const ACTIONS: Record<string, PlayerAction> = {
  " ": "toggle",
  k: "toggle",
  arrowleft: "back",
  arrowright: "forward",
  f: "fullscreen",
  m: "mute",
}

/** Where a key belongs to what it is pressed in, like typing or a focused button. */
const TAKES_KEYS = "input:not([type=range]), textarea, select, button, [contenteditable]"

/**
 * What `event` does to the player. Nothing with a modifier, which may be a lookup's Alt or the browser's own, nor in
 * an element that takes the key itself. A slider keeps its arrows.
 */
export const actionOf = (event: KeyboardEvent): PlayerAction | undefined => {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
    return undefined
  }
  const target = event.target instanceof Element ? event.target : null
  const key = event.key.toLowerCase()
  if (
    target?.closest(TAKES_KEYS) != null ||
    (target instanceof HTMLInputElement && key.startsWith("arrow"))
  ) {
    return undefined
  }
  return ACTIONS[key]
}

/** Keeps a pressed control from taking focus, so space and the arrows stay the player's. */
export const keepFocus = (event: MouseEvent) => event.preventDefault()
