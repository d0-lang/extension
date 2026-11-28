/**
 * Captions converted from Japanese TV, like NHK's, which keep ARIB STD-B24's commands in the cue text by name, like
 * `[APS_7_9]`. They place each row, size its characters and colour them.
 */

/** A command: its name and numbers, like `APS` and `7_9`. */
const COMMAND = /\[([A-Z]{2,4})((?:_\d+)*)\]/gu

/** Whether `text` is written with ARIB's commands, which every such cue starts with. */
export const isArib = (text: string): boolean => /^\[(?:CS|SWF_\d+|[NMS]SZ|APS_\d+_\d+)\]/u.test(text)

/** The colour commands, as WebVTT's colour classes. */
const COLOURS: Record<string, string> = {
  BKF: "black",
  RDF: "red",
  GRF: "lime",
  YLF: "yellow",
  BLF: "blue",
  MGF: "magenta",
  CNF: "cyan",
  WHF: "white",
}

type Size = "NSZ" | "MSZ" | "SSZ"

/** How much of a normal character's cell a size takes, across and down. Middle ones are half as wide, small ones half as tall too. */
const SCALE: Record<Size, { across: number; down: number }> = {
  NSZ: { across: 1, down: 1 },
  MSZ: { across: 0.5, down: 1 },
  SSZ: { across: 0.5, down: 0.5 },
}

/** A character, a tag or an entity of the cue's text, which a character's width is counted for. */
const UNIT = /<[^>]*>|&[a-z\d#]+;|./gsu

/** A character on screen: where its cell starts across and where it ends down, and how wide it is. */
type Placed = { text: string; x: number; width: number; bottom: number }

/** Where `text` puts its characters and its small ones, the readings over words, as ARIB lays them out. */
const layOut = (text: string) => {
  const chars: Array<Placed & { colour: string | undefined }> = []
  const readings: Array<Placed> = []
  // The character size and spacing NHK's captions set, until a cue sets its own.
  const cell = { width: 36, height: 36, across: 4, down: 24 }
  let size: Size = "NSZ"
  let colour: string | undefined
  let x = 0
  let bottom = 0
  const write = (part: string) => {
    const width = (cell.width + cell.across) * SCALE[size].across
    for (const [unit] of part.matchAll(UNIT)) {
      if (unit.startsWith("<")) {
        continue
      }
      if (size === "SSZ") {
        const last = readings.at(-1)
        if (last !== undefined && last.bottom === bottom && last.x + last.width === x) {
          last.text += unit
          last.width += width
        } else {
          readings.push({ text: unit, x, width, bottom })
        }
      } else {
        chars.push({ text: unit, x, width, bottom, colour })
      }
      x += width
    }
  }
  let at = 0
  for (const { 0: command, 1: name = "", 2: numbers = "", index } of text.matchAll(COMMAND)) {
    write(text.slice(at, index))
    at = index + command.length
    const [first = 0, second = 0] = numbers.split("_").slice(1).map(Number)
    if (name === "NSZ" || name === "MSZ" || name === "SSZ") {
      size = name
    } else if (name in COLOURS) {
      colour = COLOURS[name]
    } else if (name === "SSM") {
      cell.width = first
      cell.height = second
    } else if (name === "SHS") {
      cell.across = first
    } else if (name === "SVS") {
      cell.down = first
    } else if (name === "APS") {
      // A position counts rows and columns in the size set then, and names the bottom of its row.
      bottom = (first + 1) * (cell.height + cell.down) * SCALE[size].down
      x = second * (cell.width + cell.across) * SCALE[size].across
    }
  }
  write(text.slice(at))
  return { chars, readings }
}

/** The characters `reading` is over: on the row below it, with their middle under it. */
const baseOf = (reading: Placed, chars: ReadonlyArray<Placed>): Array<number> => {
  const below = Math.min(...chars.map(({ bottom }) => bottom).filter((bottom) => bottom > reading.bottom))
  return chars.flatMap((char, index) => {
    const middle = char.x + char.width / 2
    return char.bottom === below && middle >= reading.x && middle < reading.x + reading.width ? [index] : []
  })
}

/**
 * `text` as WebVTT cue text: a line for each row it places text on, in the colours it names, and its small text as
 * WebVTT's ruby over the characters below it, as furigana over kanji.
 */
export const aribMarkup = (text: string): string => {
  const { chars, readings } = layOut(text)
  const over = new Map<number, { reading: string; last: number }>()
  for (const reading of readings) {
    const base = baseOf(reading, chars)
    const first = base[0]
    if (first !== undefined && base.every((index, at) => index === first + at && !over.has(index))) {
      over.set(first, { reading: reading.text, last: base.at(-1)! })
    }
  }
  let markup = ""
  let end: { last: number; reading: string } | undefined
  for (const [index, char] of chars.entries()) {
    if (index > 0 && char.bottom !== chars[index - 1]!.bottom) {
      markup += "\n"
    }
    const starts = over.get(index)
    if (starts !== undefined) {
      markup += "<ruby>"
      end = starts
    }
    markup += char.colour === undefined ? char.text : `<c.${char.colour}>${char.text}</c>`
    if (end?.last === index) {
      markup += `<rt>${end.reading}</rt></ruby>`
      end = undefined
    }
  }
  return markup
}
