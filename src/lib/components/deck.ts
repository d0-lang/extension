/** The motions of `Deck.svelte`. */

/** A word kept, a keep undone, or a card sent to Anki. */
export type DeckMotion = "keep" | "undo" | "send"

/** How long each runs, after which its class comes off, so the deck shows its rest again for `single`. */
const DURATION_MS: Record<DeckMotion, number> = { keep: 1000, undo: 350, send: 800 }

const ends = new WeakMap<Element, ReturnType<typeof setTimeout>>()

/** Plays `motion` on the deck inside `root`, or on `root` itself. One still playing is cut short. */
export const playDeck = (root: Element | null | undefined, motion: DeckMotion) => {
  const deck = root?.closest(".dict-deck") ?? root?.querySelector(".dict-deck")
  if (deck === null || deck === undefined) {
    return
  }
  const classes = Object.keys(DURATION_MS).map((name) => `dict-deck-${name}`)
  deck.classList.remove(...classes)
  clearTimeout(ends.get(deck))
  // A reflow in between, or removing and adding the same class would not restart it.
  void deck.getBoundingClientRect()
  deck.classList.add(`dict-deck-${motion}`)
  // Each motion ends looking like the deck at rest, so taking the class off shows no jump.
  ends.set(
    deck,
    setTimeout(() => deck.classList.remove(...classes), DURATION_MS[motion]),
  )
}
