/** The text of a subtitle file, in whatever encoding it was saved in, as older files were saved in their language's own. */

/** The encodings a language's older files are mostly in, most used first. Languages not here use Western European. */
const ENCODINGS: Record<string, ReadonlyArray<string>> = {
  ru: ["windows-1251"],
  uk: ["windows-1251"],
  be: ["windows-1251"],
  bg: ["windows-1251"],
  sr: ["windows-1251", "windows-1250"],
  mk: ["windows-1251"],
  pl: ["windows-1250"],
  cs: ["windows-1250"],
  sk: ["windows-1250"],
  hu: ["windows-1250"],
  ro: ["windows-1250"],
  hr: ["windows-1250"],
  sl: ["windows-1250"],
  bs: ["windows-1250"],
  el: ["windows-1253"],
  tr: ["windows-1254"],
  he: ["windows-1255"],
  ar: ["windows-1256"],
  fa: ["windows-1256"],
  lt: ["windows-1257"],
  lv: ["windows-1257"],
  et: ["windows-1257"],
  vi: ["windows-1258"],
  th: ["windows-874"],
  ja: ["shift_jis", "euc-jp"],
  zh: ["gbk", "big5"],
  "zh-TW": ["big5"],
  "zh-HK": ["big5"],
  "zh-Hant": ["big5"],
  ko: ["euc-kr"],
}

const WESTERN = "windows-1252"

/** The encodings `lang`'s older files are mostly in. */
const encodingsOf = (lang: string): ReadonlyArray<string> =>
  ENCODINGS[lang] ?? ENCODINGS[lang.split("-")[0]!] ?? [WESTERN]

/**
 * The encodings tried on a file whose name says no language, most used first. The browser's detection goes by script,
 * so text garbled into another script, like Russian read as Greek or Thai, or any of these read as Korean, is found to
 * be in its language as surely. Those encodings are left to the file's name.
 */
const TRIED = [WESTERN, "windows-1251", "windows-1250", "shift_jis", "gbk", "big5"]

/** How much of a text has to be found in one language for its encoding to be taken. */
const MIN_PERCENTAGE = 50

/**
 * Half-width katakana, which an older Western or Cyrillic file read as Shift_JIS turns into, and which subtitles hardly
 * ever use, so a reading with them is taken for garbled.
 */
const HALF_WIDTH_KANA = /[\uff61-\uff9f]/u

/** `bytes` in `encoding`, or nothing when they are not valid in it. */
const decode = (bytes: Uint8Array, encoding: string, fatal = true): string | undefined => {
  try {
    return new TextDecoder(encoding, { fatal }).decode(bytes)
  } catch {
    return undefined
  }
}

/** The languages a text is detected to be in, with how much of it is in each, as `i18n.detectLanguage` gives them. */
export type Detect = (text: string) => Promise<ReadonlyArray<{ language: string; percentage: number }>>

/**
 * The text of a file's `bytes`. A byte order mark says UTF-16 or UTF-8, and text that is valid UTF-8 is that. Else it
 * is in an older encoding: the one `lang`, the language the file's name says, is mostly saved in, or else the first of
 * the most used ones whose text `detect` finds a language in that is saved in it, which garbled text mostly is not.
 * `sample` is the part of a text the language is read from, like its cues without the file's own words around them.
 * Nothing found reads it as UTF-8 still.
 */
export const decodeSubtitles = async (
  buffer: ArrayBuffer,
  lang: string | undefined,
  sample: (text: string) => string,
  detect: Detect,
): Promise<string> => {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes)
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes)
  }
  // A file that says it is UTF-8 is, with any broken character in it replaced.
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes)
  }
  const utf8 = decode(bytes, "utf-8")
  if (utf8 !== undefined) {
    return utf8
  }
  if (lang === undefined) {
    return (await found(bytes, TRIED, sample, detect)) ?? new TextDecoder("utf-8").decode(bytes)
  }
  const named = encodingsOf(lang)
  // Of a language with more than one, the encoding its text is found in, as one may read the other's bytes too.
  const chosen = named.length > 1 ? await found(bytes, named, sample, detect) : undefined
  return chosen ?? readable(bytes, named[0]!) ?? decode(bytes, named[0]!, false)!
}

/** `bytes` in `encoding`, unless they are not valid in it or come out garbled into half-width katakana. */
const readable = (bytes: Uint8Array, encoding: string): string | undefined => {
  const text = decode(bytes, encoding)
  return text === undefined || HALF_WIDTH_KANA.test(text) ? undefined : text
}

/** The text of `bytes` in the first of `encodings` whose text `detect` finds a language saved in it in. */
const found = async (
  bytes: Uint8Array,
  encodings: ReadonlyArray<string>,
  sample: (text: string) => string,
  detect: Detect,
): Promise<string | undefined> => {
  for (const encoding of encodings) {
    const text = readable(bytes, encoding)
    if (text !== undefined) {
      const [best] = await detect(sample(text))
      if (
        best !== undefined &&
        best.percentage >= MIN_PERCENTAGE &&
        encodingsOf(best.language).includes(encoding)
      ) {
        return text
      }
    }
  }
  return undefined
}
