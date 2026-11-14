/** What the tags beside a headword stand for: `pos` named by the client, labels as the server explains them. */
import type { LabelExplanation, PairLabels } from "$lib/storage"

/** The Universal Dependencies part-of-speech tags, by the name the popover shows. */
const POS_NAMES: Readonly<Record<string, string>> = {
  ADJ: "adjective",
  ADP: "adposition",
  ADV: "adverb",
  AUX: "auxiliary",
  CCONJ: "conjunction",
  DET: "determiner",
  INTJ: "interjection",
  NOUN: "noun",
  NUM: "numeral",
  PART: "particle",
  PRON: "pronoun",
  PROPN: "proper noun",
  PUNCT: "punctuation",
  SCONJ: "conjunction",
  SYM: "symbol",
  VERB: "verb",
}

/**
 * The name of a UD tag (`NOUN` → noun). A tag outside the set is shown as sent.
 * `X` is empty: it only says no tag fits, like on an ending, and "other" would read as a word class.
 */
export const posName = (pos: string): string =>
  pos === "X" ? "" : Object.hasOwn(POS_NAMES, pos) ? POS_NAMES[pos]! : pos

/** The explanation of `label`, if the server sent one. Keys like `constructor` are not looked up on the prototype. */
export const explanationOf = (labels: PairLabels, label: string): LabelExplanation | undefined =>
  Object.hasOwn(labels, label) ? labels[label] : undefined
