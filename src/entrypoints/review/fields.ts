/** A kept word, with the meanings picked and the text edited for it, as the fields of a DaDict note. */
import { escapeHtml, stressedHtml } from "$lib/anki/fields"
import type { Field } from "$lib/anki/note-type"
import { excerptAround, placeMatch } from "$lib/dict/match"
import type { LookupEntry } from "$lib/dict/types"
import { posName } from "$lib/popover/labels"
import type { CardDraft, CardSeed } from "$lib/storage"

/** A card's sentence is cut to the clauses around the word past this, which is about two lines on a phone. */
const MAX_CARD_SENTENCE = 160

/** Marks a part of the sentence as bold, in the text the user edits. */
const BOLD = "**"

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

/** The sentence as the user edits it: cut around the bold parts when long, with `**` around them. */
export const markedSentence = (text: string, spans: ReadonlyArray<[number, number]>): string => {
  const first = spans[0]?.[0] ?? 0
  const last = spans.at(-1)?.[1] ?? text.length
  const [from, to] = excerptAround(text, first, last, MAX_CARD_SENTENCE) ?? [0, text.length]
  let marked = from > 0 ? "…" : ""
  let at = from
  for (const [start, end] of spans) {
    marked += `${text.slice(at, start)}${BOLD}${text.slice(start, end)}${BOLD}`
    at = end
  }
  return marked + text.slice(at, to) + (to < text.length ? "…" : "")
}

/** `marked` as HTML, with each pair of `**` bolding what is between. A lone `**` stays as typed. */
export const markedHtml = (marked: string): string =>
  marked
    .split(BOLD)
    .map((part, index, parts) =>
      index % 2 === 0
        ? escapeHtml(part)
        : index === parts.length - 1
          ? escapeHtml(`${BOLD}${part}`)
          : `<b>${escapeHtml(part)}</b>`,
    )
    .join("")

/** The entry the popover kept, with its only sense picked when it has one. Several wait for the user. */
export const firstDraft = (seed: CardSeed, entry: number = seed.entry): CardDraft => ({
  entry,
  senses: seed.entries[entry]?.senses.length === 1 ? [0] : [],
})

/** The sentence of the draft's entry as the user edits it, as they left it or as it starts. Empty without one. */
export const draftSentence = (seed: CardSeed, draft: CardDraft): string => {
  const entry = seed.entries[draft.entry]
  if (draft.sentence !== undefined || seed.sentence === undefined || entry === undefined) {
    return draft.sentence ?? ""
  }
  return markedSentence(seed.sentence.text, boldSpans(seed.sentence, seed.word, entry))
}

/** A sense's text as the user left it, or the server's glosses. */
export const senseText = (seed: CardSeed, draft: CardDraft, index: number): string => {
  const key = String(index)
  return draft.glosses !== undefined && Object.hasOwn(draft.glosses, key)
    ? draft.glosses[key]!
    : (seed.entries[draft.entry]?.senses[index]?.glosses.join("; ") ?? "")
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
  draft: CardDraft,
  ipa: boolean,
): Record<Exclude<Field, "Audio">, string> | undefined => {
  const entry = seed.entries[draft.entry]
  if (entry === undefined) {
    return undefined
  }
  const reading = entry.pron?.reading
  const glosses = draft.senses
    .filter((index) => index < entry.senses.length)
    .map((index) => senseText(seed, draft, index).trim())
    .filter((gloss) => gloss !== "")
  return {
    Word: stressedHtml(entry.lemma),
    Reading: reading === undefined || reading === entry.lemma ? "" : stressedHtml(reading),
    Pronunciation: ipa ? escapeHtml(entry.pron?.ipa?.[0] ?? "") : "",
    "Part of speech": escapeHtml(posName(entry.pos)),
    Meaning: glosses.length === 0 ? "" : meaningHtml(glosses),
    Sentence: markedHtml(draftSentence(seed, draft).trim()),
    Source: sourceHtml(seed.page),
  }
}
