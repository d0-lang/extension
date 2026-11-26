/** Asks Anki for the popover, which a page's own rules would keep from reaching it. */
import { lemmasInAnki } from "$lib/anki/duplicates"
import { getAnkiEnabled, getAnkiTarget } from "$lib/storage"

/** Which of `lemmas` Anki has a DaDict note for. None while Anki is off in settings or not answering. */
export const inAnki = async (lemmas: Array<string>): Promise<Array<string>> => {
  if (lemmas.length === 0 || !(await getAnkiEnabled())) {
    return []
  }
  const found = await lemmasInAnki(await getAnkiTarget(), lemmas)
  return found.unwrapOr([])
}
