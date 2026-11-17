/** What the popover preview shows: an English word, as a server would answer it, whatever languages are bound. */
import type { LookupEntry } from "$lib/dict/types"
import type { PairLabels } from "$lib/storage"

export const SAMPLE_ENTRIES: Array<LookupEntry> = [
  {
    lemma: "mother",
    pos: "NOUN",
    labels: undefined,
    pron: {
      ipa: ["/ˈmʌðə/", "/ˈmʌðɚ/"],
      // A real recording, on a host any server may link, so the play button plays.
      audio: [
        { url: "https://upload.wikimedia.org/wikipedia/commons/0/07/En-us-mother.ogg", source: undefined },
      ],
    },
    senses: [{ glosses: ["a female parent"] }, { glosses: ["the source or origin of something"] }],
  },
  {
    lemma: "mother",
    pos: "VERB",
    labels: ["transitive"],
    pron: undefined,
    senses: [{ glosses: ["to look after someone kindly, and sometimes too closely"] }],
  },
]

export const SAMPLE_LABELS: PairLabels = {
  transitive: { name: "Transitive", text: "Takes a direct object." },
}

/** Shown in the footer while fewer than two languages are bound, so there is something to switch between. */
export const SAMPLE_LANGUAGES = ["en_en", "de_en", "fr_en", "es_en"]
