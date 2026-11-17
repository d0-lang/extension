/** What the popover preview shows: a German word, as a server would answer it. */
import type { LookupEntry } from "$lib/dict/types"

/** Its audio is on this host, which the play button allows. The preview never plays it. */
export const SAMPLE_SERVER = "https://dict.example.org"

export const SAMPLE_ENTRIES: Array<LookupEntry> = [
  {
    lemma: "Mutter",
    pos: "NOUN",
    labels: ["f"],
    pron: { ipa: ["/ˈmʊtɐ/"], audio: [{ url: `${SAMPLE_SERVER}/audio/mutter.mp3`, source: undefined }] },
    senses: [{ glosses: ["mother"], see: ["Mama"] }, { glosses: ["nut (threaded fastener)"] }],
  },
  {
    lemma: "Muttersprache",
    pos: "NOUN",
    labels: ["f"],
    pron: { ipa: ["/ˈmʊtɐˌʃpʁaːxə/"], audio: undefined },
    senses: [{ glosses: ["mother tongue, native language"] }],
  },
]

/** The languages in the preview's footer, German first. */
export const SAMPLE_LANGUAGES = ["de_en", "nl_en", "pl_en", "uk_en"]
