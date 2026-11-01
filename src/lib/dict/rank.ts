/** What the page knows about its language. */
export type LookupHints = {
  /** Chosen by the user for this page. */
  pinned: string | undefined
  /** Detected from the text around the word, best first. */
  detected: Array<string>
  /** The language that last returned entries on this page. */
  lastWorked: string | undefined
}

// `de_en` is German to English. A detected `zh-Hant` is matched as `zh`.
const baseLanguage = (code: string): string =>
  code.toLowerCase().split(/[-_]/, 1)[0] ?? ""

/**
 * Bound languages to try, in order.
 * A detected language that is bound is the only one tried, so the word goes to one server.
 */
export const rankLanguages = (
  bound: ReadonlyArray<string>,
  { pinned, detected, lastWorked }: LookupHints,
): Array<string> => {
  if (pinned !== undefined && bound.includes(pinned)) {
    return [pinned]
  }
  for (const code of bound.length > 1 ? detected : []) {
    const matches = bound.filter((lang) => baseLanguage(lang) === baseLanguage(code))
    if (matches.length > 0) {
      return matches
    }
  }
  return lastWorked !== undefined && bound.includes(lastWorked)
    ? [lastWorked, ...bound.filter((lang) => lang !== lastWorked)]
    : [...bound]
}
