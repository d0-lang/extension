/** A kept word, with the meanings picked for it, as the fields of a DaDict note. */
import { escapeHtml, stressedHtml } from "$lib/anki/fields"
import type { Field } from "$lib/anki/note-type"
import { excerptAround, placeMatch } from "$lib/dict/match"
import type { LookupEntry } from "$lib/dict/types"
import { posName } from "$lib/popover/labels"
import type { CardSeed } from "$lib/storage"

/** A card's sentence is cut to the clauses around the word past this, which is about two lines on a phone. */
const MAX_CARD_SENTENCE = 160

/** What the user picked: which of the seed's entries becomes the card, and which of its senses, by index. */
export type Choice = { entry: number; senses: Array<number> }

/** Where the `at`th copy of `word` starts in `text`, counted as the protocol counts them. */
const copyStart = (text: string, word: string, at: number): number | undefined => {
  let index = -1
  for (let copy = 0; copy < at; copy++) {
    index = text.indexOf(word, copy === 0 ? 0 : index + word.length)
    if (index < 0) {
      return undefined
    }
  }
  return index
}

/**
 * The spans of `sentence` to bold: the parts the entry's `match` names, around the clicked copy of `word`.
 * The clicked word alone when the entry has no `match`, like the word's own entries.
 */
export const boldSpans = (
  sentence: { text: string; at?: number },
  word: string,
  entry: LookupEntry,
): Array<[number, number]> => {
  const clicked = copyStart(sentence.text, word, sentence.at ?? 1)
  if (clicked === undefined) {
    return []
  }
  const matched = entry.match === undefined ? undefined : placeMatch(sentence.text, entry.match, clicked)
  return matched ?? [[clicked, clicked + word.length]]
}

/** The sentence as HTML, cut around the bold parts when long, with an ellipsis where it was cut. */
export const sentenceHtml = (text: string, spans: ReadonlyArray<[number, number]>): string => {
  const first = spans[0]?.[0] ?? 0
  const last = spans.at(-1)?.[1] ?? text.length
  const [from, to] = excerptAround(text, first, last, MAX_CARD_SENTENCE) ?? [0, text.length]
  let html = from > 0 ? "…" : ""
  let at = from
  for (const [start, end] of spans) {
    html += `${escapeHtml(text.slice(at, start))}<b>${escapeHtml(text.slice(start, end))}</b>`
    at = end
  }
  return html + escapeHtml(text.slice(at, to)) + (to < text.length ? "…" : "")
}

const meaningHtml = (glosses: Array<string>): string =>
  glosses.length === 1
    ? `<p>${escapeHtml(glosses[0]!)}</p>`
    : `<ol>${glosses.map((gloss) => `<li>${escapeHtml(gloss)}</li>`).join("")}</ol>`

/** A link to the page, or its title alone for one Anki could not open, like the extension's own player. */
const sourceHtml = ({ url, title }: CardSeed["page"]): string => {
  const name = escapeHtml(title.trim() === "" ? url : title.trim())
  return /^https?:\/\//.test(url) ? `<a href="${escapeHtml(url)}">${name}</a>` : name
}

/** Every field but `Audio`, which Anki fills when it stores the recording. Unset for an entry the seed lacks. */
export const noteFields = (
  seed: CardSeed,
  choice: Choice,
  ipa: boolean,
): Record<Exclude<Field, "Audio">, string> | undefined => {
  const entry = seed.entries[choice.entry]
  if (entry === undefined) {
    return undefined
  }
  const reading = entry.pron?.reading
  const glosses = choice.senses.flatMap((index) => entry.senses[index]?.glosses.join("; ") ?? [])
  return {
    Word: stressedHtml(entry.lemma),
    Reading: reading === undefined || reading === entry.lemma ? "" : stressedHtml(reading),
    Pronunciation: ipa ? escapeHtml(entry.pron?.ipa?.[0] ?? "") : "",
    "Part of speech": escapeHtml(posName(entry.pos)),
    Meaning: glosses.length === 0 ? "" : meaningHtml(glosses),
    Sentence:
      seed.sentence === undefined
        ? ""
        : sentenceHtml(seed.sentence.text, boldSpans(seed.sentence, seed.word, entry)),
    Source: sourceHtml(seed.page),
  }
}
