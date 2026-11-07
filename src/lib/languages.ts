/** Human names for language pairs, in the browser's language. */
import type { LanguagePair } from "./storage"

const names = new Intl.DisplayNames(undefined, { type: "language", fallback: "code" })

const languageName = (code: string): string => {
  try {
    return names.of(code) ?? code
  } catch {
    // `of` throws on a code that is not well-formed BCP 47.
    return code
  }
}

/** `de_en` → "German → English". */
export const pairName = (pair: LanguagePair): string => pair.split("_").map(languageName).join(" → ")

/** The language a pair translates from, and the one it translates into. */
const splitPair = (pair: LanguagePair): { from: string; into: string } => {
  const [from = pair, into = ""] = pair.split("_")
  return { from, into }
}

/** `de_en` → "German". */
export const sourceName = (pair: LanguagePair): string => languageName(splitPair(pair).from)

const byName = (a: string, b: string): number => a.localeCompare(b)

/** Pairs grouped by the language they translate into, both sorted by name. `into` is that language's name. */
export const groupByTarget = (
  pairs: ReadonlyArray<LanguagePair>,
): Array<{ into: string; pairs: Array<LanguagePair> }> => {
  const groups = Map.groupBy(pairs, (pair) => languageName(splitPair(pair).into))
  return [...groups]
    .sort(([a], [b]) => byName(a, b))
    .map(([into, grouped]) => ({ into, pairs: grouped.sort((a, b) => byName(sourceName(a), sourceName(b))) }))
}

/** Whether `query` is in either language's name or in the code, ignoring case. */
export const pairMatches = (pair: LanguagePair, query: string): boolean => {
  const needle = query.trim().toLocaleLowerCase()
  return [pairName(pair), pair].some((text) => text.toLocaleLowerCase().includes(needle))
}
