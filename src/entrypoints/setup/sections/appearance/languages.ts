/** The bound languages in the order the popover's footer shows them. */
import { boundLanguages } from "$lib/dict"
import { getLanguageOrder, orderLanguages } from "$lib/storage"

/** Storage keys that change the languages or their order. */
export const LANGUAGE_KEYS = ["servers", "serverByLang", "serverIssues", "languageOrder"]

/** Every bound language in order, with the paused ones in their place, and which of them are paused. */
export const orderedLanguages = async (): Promise<{ order: Array<string>; paused: Array<string> }> => {
  const [bound, stored] = await Promise.all([
    boundLanguages().unwrapOr({ languages: [], paused: [] }),
    getLanguageOrder(),
  ])
  return { order: orderLanguages([...bound.languages, ...bound.paused], stored), paused: bound.paused }
}
