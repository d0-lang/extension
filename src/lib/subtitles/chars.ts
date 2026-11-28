/** A cue read a character at a time, with how each is drawn, for subtitles that style parts of a cue. */
import type { Ruby, StyleRun, Styled, TextStyle } from "./rows"

/** A reading over characters, which each of them holds, so the ones a reading is over stay together. */
export type Reading = { text: string }

/** A character of a cue, how it is drawn, and the reading over it, if any. */
export type Char = { char: string; style: TextStyle | undefined; reading?: Reading | undefined }

/** One space between words, none at the ends, as `tidy` makes them. A space keeps the style of the first it stands for. */
const tidyLine = (line: ReadonlyArray<Char>): Array<Char> => {
  const tidied: Array<Char> = []
  for (const char of line) {
    if (!/\s/u.test(char.char)) {
      tidied.push(char)
    } else if (tidied.length > 0 && tidied.at(-1)!.char !== " ") {
      tidied.push({ char: " ", style: char.style, reading: char.reading })
    }
  }
  if (tidied.at(-1)?.char === " ") {
    tidied.pop()
  }
  return tidied
}

const sameStyle = (a: TextStyle, b: TextStyle): boolean => JSON.stringify(a) === JSON.stringify(b)

const styleIn = ({ from: _from, to: _to, ...style }: StyleRun): TextStyle => style

/** Where each style runs. Unstyled text has none. */
const runsOf = (chars: ReadonlyArray<Char>): Array<StyleRun> => {
  const runs: Array<StyleRun> = []
  for (const [index, { style }] of chars.entries()) {
    const last = runs.at(-1)
    if (style === undefined) {
      continue
    }
    if (last !== undefined && last.to === index && sameStyle(styleIn(last), style)) {
      last.to = index + 1
    } else {
      runs.push({ ...style, from: index, to: index + 1 })
    }
  }
  return runs
}

/** Where each reading is over. */
const rubyOf = (chars: ReadonlyArray<Char>): Array<Ruby> => {
  const ruby: Array<Ruby & { reading: Reading }> = []
  for (const [index, { reading }] of chars.entries()) {
    const last = ruby.at(-1)
    if (reading === undefined) {
      continue
    }
    if (last !== undefined && last.to === index && last.reading === reading) {
      last.to = index + 1
    } else {
      ruby.push({ from: index, to: index + 1, text: reading.text, reading })
    }
  }
  return ruby.map(({ from, to, text }) => ({ from, to, text }))
}

/**
 * A cue's text from its characters, with `\n` between lines, and where each style runs. Every line is tidied, and an
 * empty one left out. `styles` is left out when nothing is styled.
 */
export const styledOf = (chars: ReadonlyArray<Char>): Styled => {
  const lines = chars
    .reduce<Array<Array<Char>>>(
      (lines, char) => (char.char === "\n" ? [...lines, []] : (lines.at(-1)!.push(char), lines)),
      [[]],
    )
    .map(tidyLine)
    .filter((line) => line.length > 0)
  const tidied = lines.flatMap((line, index) => [
    ...(index === 0 ? [] : [{ char: "\n", style: undefined }]),
    ...line,
  ])
  const styles = runsOf(tidied)
  const ruby = rubyOf(tidied)
  return {
    text: tidied.map(({ char }) => char).join(""),
    ...(styles.length > 0 && { styles }),
    ...(ruby.length > 0 && { ruby }),
  }
}
