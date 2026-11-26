import { orderLanguages, type LanguagePair, type SourceLanguage } from "$lib/storage"

/** The word languages of `pairs`, each once, in the user's language order. */
export const sourceLanguages = (
  pairs: ReadonlyArray<LanguagePair>,
  order: ReadonlyArray<LanguagePair>,
): Array<SourceLanguage> => [
  ...new Set(orderLanguages(pairs, order).map((pair) => pair.split("_", 1)[0] ?? pair)),
]
