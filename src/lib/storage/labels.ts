/** The last label explanations each server sent, kept until a later fetch succeeds. */
import type { LanguagePair } from "./servers"

/** What a label stands for, and optionally a longer explanation. Both are plain text. */
export type LabelExplanation = { name: string; text?: string }
/** Label string → its explanation, for one language pair. */
export type PairLabels = Record<string, LabelExplanation>
export type LabelsByPair = Record<LanguagePair, PairLabels>
/** Server URL → the explanations it last sent. */
export type ServerLabels = Record<string, LabelsByPair>

const empty = {
  serverLabels: {} as ServerLabels,
}

export const getServerLabels = async (): Promise<ServerLabels> => {
  const { serverLabels } = await browser.storage.local.get("serverLabels")
  return serverLabels !== undefined && typeof serverLabels === "object" && !Array.isArray(serverLabels)
    ? (serverLabels as ServerLabels)
    : empty.serverLabels
}

/** `labels` unset drops what was kept for `url`. */
export const setServerLabels = async (url: string, labels: LabelsByPair | undefined): Promise<void> => {
  const { [url]: _old, ...rest } = await getServerLabels()
  await browser.storage.local.set({ serverLabels: labels === undefined ? rest : { ...rest, [url]: labels } })
}
