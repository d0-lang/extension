/** The language a subtitle file is in, for lookups and for how its words are split. */
import { detectLanguages } from "$lib/page/language"
import type { Cue } from "$lib/subtitles/cues"
import { stemOf } from "./files"

/** Parts of a subtitle file's name that say what kind it is, not its language, like `Film.en.forced.srt`. */
const FLAGS = new Set(["forced", "sdh", "cc", "default", "full", "signs", "songs"])

/** How much of a file's text goes to detection, which is reliable well below this. */
const SAMPLE_CHARS = 2000

const names = new Intl.DisplayNames("en", { type: "language", fallback: "none" })

/**
 * The language a subtitle file's name ends in, like `de` in `Film.de.srt` or `Film.ger.forced.srt`. Nothing when the
 * last part of the name is not a language.
 */
export const languageInName = (name: string): string | undefined => {
  const parts = stemOf(name).split(".").slice(1)
  const last = parts.findLast((part) => !FLAGS.has(part.toLowerCase()))
  if (last === undefined || !/^[a-z]{2,3}(?:[-_][a-z0-9]{2,4})?$/iu.test(last)) {
    return undefined
  }
  try {
    const [code] = Intl.getCanonicalLocales(last.replace("_", "-"))
    return code !== undefined && names.of(code) !== undefined ? code : undefined
  } catch {
    // `getCanonicalLocales` throws on a tag that is not well-formed.
    return undefined
  }
}

/** Some of `cues`' text from a third of the way in, past opening credits and songs. */
const sampleOf = (cues: ReadonlyArray<Cue>): string => {
  const text = cues.map(({ text }) => text).join("\n")
  const from = Math.max(0, Math.min(Math.floor(text.length / 3), text.length - SAMPLE_CHARS))
  return text.slice(from, from + SAMPLE_CHARS)
}

/**
 * The language of a subtitle file: the one its name ends in, or else the one its text is detected to be in. Empty when
 * neither says.
 */
export const languageOf = async (name: string, cues: ReadonlyArray<Cue>): Promise<string> =>
  languageInName(name) ?? (await detectLanguages(sampleOf(cues)))[0] ?? ""
