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

/** Small characters take half a row, so a row counted in them is half one counted in normal or middle ones. */
const SMALL = "SSZ"

/**
 * `text` as WebVTT cue text: a line for each row it places text on, in the colours it names. Small text is the
 * reading over a word, which the subtitles have no room for, so it goes.
 */
export const aribMarkup = (text: string): string => {
  let size = "NSZ"
  let colour: string | undefined
  let row: number | undefined
  let markup = ""
  let at = 0
  const write = (part: string) => {
    if (size !== SMALL && part !== "") {
      markup += colour === undefined ? part : `<c.${colour}>${part}</c>`
    }
  }
  for (const { 0: command, 1: name = "", 2: numbers = "", index } of text.matchAll(COMMAND)) {
    write(text.slice(at, index))
    at = index + command.length
    if (name === "NSZ" || name === "MSZ" || name === "SSZ") {
      size = name
    } else if (name in COLOURS) {
      colour = COLOURS[name]
    } else if (name === "APS") {
      const placed = Number(numbers.split("_")[1]) / (size === SMALL ? 2 : 1)
      if (row !== undefined && placed !== row) {
        markup += "\n"
      }
      row = placed
    }
  }
  write(text.slice(at))
  return markup
}
