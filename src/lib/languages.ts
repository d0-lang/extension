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
export const pairName = (pair: LanguagePair): string =>
  pair.split("_").map(languageName).join(" → ")
