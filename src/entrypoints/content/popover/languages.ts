/** `de_en` → `de`, the short name a language gets in the popover's footer. */

const sourceOf = (pair: string): string => pair.split("_", 1)[0] ?? pair

/**
 * Each pair in `pairs` by its source language alone, since they mostly translate into the same one.
 * Pairs that share a source show the target too, like `de→en` and `de→de`.
 */
export const shortNames = (pairs: ReadonlyArray<string>): Map<string, string> =>
  new Map(
    pairs.map((pair) => [
      pair,
      pairs.some((other) => other !== pair && sourceOf(other) === sourceOf(pair))
        ? pair.replace("_", "→")
        : sourceOf(pair),
    ]),
  )
