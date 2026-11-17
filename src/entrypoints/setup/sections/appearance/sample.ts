/** What the popover preview shows: English words, as a server would answer them, whatever languages are bound. */
import type { LookupEntry } from "$lib/dict/types"
import type { CreditSource, PairLabels } from "$lib/storage"

/** The word the preview opens on. Its first sense links to the other. */
export const SAMPLE_WORD = "mother"

/** Real recordings on Wikimedia Commons, a host any server may link, so the play button plays them. */
export const SAMPLE_ENTRIES: Array<LookupEntry> = [
  {
    lemma: "mother",
    pos: "NOUN",
    labels: undefined,
    pron: {
      ipa: ["/ˈmʌðə/", "/ˈmʌðɚ/"],
      audio: [
        {
          url: "https://upload.wikimedia.org/wikipedia/commons/0/07/En-us-mother.ogg",
          source: "https://commons.wikimedia.org/wiki/File:En-us-mother.ogg",
        },
      ],
    },
    senses: [
      { glosses: ["a female parent", "mom"], see: ["mom"] },
      { glosses: ["the source or origin of something"] },
    ],
    sources: ["https://en.wiktionary.org/wiki/mother"],
  },
  {
    lemma: "mother",
    pos: "VERB",
    labels: ["transitive"],
    pron: undefined,
    senses: [{ glosses: ["to look after someone kindly, and sometimes too closely"] }],
    sources: ["https://en.wiktionary.org/wiki/mother"],
  },
  {
    lemma: "mom",
    pos: "NOUN",
    labels: ["US", "informal"],
    pron: {
      ipa: ["/mɑm/"],
      audio: [
        {
          url: "https://upload.wikimedia.org/wikipedia/commons/8/81/En-us-mom.ogg",
          source: "https://commons.wikimedia.org/wiki/File:En-us-mom.ogg",
        },
      ],
    },
    senses: [{ glosses: ["mother"], see: ["mother"] }],
    sources: ["https://en.wiktionary.org/wiki/mom"],
  },
]

export const SAMPLE_LABELS: PairLabels = {
  transitive: { name: "Transitive", text: "Takes a direct object." },
  US: { name: "American English" },
  informal: { name: "Informal", text: "Used in everyday speech, not in formal writing." },
}

/** Both recordings are CC BY-SA 3.0, by Dvortygirl. */
export const SAMPLE_SOURCES: Array<CreditSource> = [
  { name: "Wiktionary", url: "https://en.wiktionary.org/", license: "CC BY-SA 4.0" },
  { name: "Wikimedia Commons", url: "https://commons.wikimedia.org/", license: "CC BY-SA 3.0" },
]

/** Shown in the footer while fewer than two languages are bound, so there is something to switch between. */
export const SAMPLE_LANGUAGES = ["en_en", "de_en", "fr_en", "es_en"]
