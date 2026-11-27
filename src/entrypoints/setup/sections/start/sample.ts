/** The sentence Get started tries lookups on: English, with answers made up here, so it works whatever is bound. */
import type { LookupEntry } from "$lib/dict/types"

export const SAMPLE_SENTENCE = "My mother bakes bread every Sunday."

/** By the word as written, lowercased. `bakes` opens on `bake`, as a server answers with the dictionary form. */
export const SAMPLE_ENTRIES: Record<string, Array<LookupEntry>> = {
  my: [
    {
      lemma: "my",
      pos: "DET",
      labels: undefined,
      pron: { ipa: ["/maɪ/"] },
      senses: [{ glosses: ["belonging to me"] }],
    },
  ],
  mother: [
    {
      lemma: "mother",
      pos: "NOUN",
      labels: undefined,
      pron: { ipa: ["/ˈmʌðə/"] },
      senses: [{ glosses: ["a female parent", "mom"] }, { glosses: ["the source or origin of something"] }],
    },
  ],
  bakes: [
    {
      lemma: "bake",
      pos: "VERB",
      labels: undefined,
      pron: { ipa: ["/beɪk/"] },
      senses: [{ glosses: ["to cook something in an oven"] }, { glosses: ["to be cooked in an oven"] }],
    },
  ],
  bread: [
    {
      lemma: "bread",
      pos: "NOUN",
      labels: undefined,
      pron: { ipa: ["/bɹɛd/"] },
      senses: [{ glosses: ["a food made from flour, water and yeast"] }],
    },
  ],
  every: [
    {
      lemma: "every",
      pos: "DET",
      labels: undefined,
      pron: { ipa: ["/ˈɛvɹi/"] },
      senses: [{ glosses: ["each one, without leaving any out"] }],
    },
  ],
  sunday: [
    {
      lemma: "Sunday",
      pos: "PROPN",
      labels: undefined,
      pron: { ipa: ["/ˈsʌndeɪ/"] },
      senses: [{ glosses: ["the day of the week after Saturday"] }],
    },
  ],
}

/** The sentence cut into its words, which have entries, and what is between them. */
export const samplePieces = (): Array<{ text: string; word?: string }> =>
  SAMPLE_SENTENCE.split(/(\p{L}+)/u)
    .filter((text) => text !== "")
    .map((text) =>
      Object.hasOwn(SAMPLE_ENTRIES, text.toLowerCase()) ? { text, word: text.toLowerCase() } : { text },
    )
