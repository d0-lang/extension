/** The motions of `Deck.svelte`. */

/** A word kept, a keep undone, or a card sent to Anki. */
export type DeckMotion = "keep" | "undo" | "send"

const MOTIONS: Array<DeckMotion> = ["keep", "undo", "send"]

/**
 * Plays `motion` on the deck inside `root`, or on `root` itself. One still playing is cut short. The last one's class
 * stays, which is harmless: each motion ends looking like the deck at rest.
 */
export const playDeck = (root: Element | null | undefined, motion: DeckMotion) => {
  const deck = root?.closest(".dict-deck") ?? root?.querySelector(".dict-deck")
  if (deck === null || deck === undefined) {
    return
  }
  deck.classList.remove(...MOTIONS.map((name) => `dict-deck-${name}`))
  // A reflow in between, or removing and adding the same class would not restart it.
  void deck.getBoundingClientRect()
  deck.classList.add(`dict-deck-${motion}`)
}
