/** Human names for languages and language pairs, in the browser's language. */
import type { LanguagePair } from "./storage"

const names = new Intl.DisplayNames(undefined, { type: "language", fallback: "code" })

/** `de` → "German". */
export const languageName = (code: string): string => {
  try {
    return names.of(code) ?? code
  } catch {
    // `of` throws on a code that is not well-formed BCP 47.
    return code
  }
}

/** `de_en` → "German → English". */
export const pairName = (pair: LanguagePair): string => pair.split("_").map(languageName).join(" → ")

const sourceOf = (pair: LanguagePair): string => pair.split("_", 1)[0] ?? pair

/**
 * Each pair in `pairs` by its source language alone, like `de` for `de_en`, since they mostly translate into the
 * same one. Pairs that share a source show the target too, like `de→en` and `de→de`.
 */
export const shortNames = (pairs: ReadonlyArray<LanguagePair>): Map<LanguagePair, string> =>
  new Map(
    pairs.map((pair) => [
      pair,
      pairs.some((other) => other !== pair && sourceOf(other) === sourceOf(pair))
        ? pair.replace("_", "→")
        : sourceOf(pair),
    ]),
  )
