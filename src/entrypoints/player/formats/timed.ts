/** Subtitle files made of blocks of a timing line and text, like SRT and WebVTT. */
import type { Cue } from "$lib/subtitles/cues"
import { plainText } from "$lib/subtitles/markup"

/** `01:02:03,456`, or `02:03.456` without hours as WebVTT allows. */
const TIME = String.raw`(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})`
const TIMING = new RegExp(String.raw`^\s*${TIME}\s*-->\s*${TIME}`, "u")

const msOf = (hours: string | undefined, minutes: string, seconds: string, fraction: string): number =>
  ((Number(hours ?? 0) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000 +
  Number(fraction.padEnd(3, "0"))

/** When a timing line, like `00:00:01,000 --> 00:00:02,500 X1:40`, starts and ends. */
export const timingOf = (line: string): { startMs: number; endMs: number } | undefined => {
  const match = TIMING.exec(line)
  if (match === null) {
    return undefined
  }
  const [, startH, startM, startS, startF, endH, endM, endS, endF] = match
  return { startMs: msOf(startH, startM!, startS!, startF!), endMs: msOf(endH, endM!, endS!, endF!) }
}

/**
 * The cues of an SRT or WebVTT file, as plain text, in the order the file has them. A block without a timing line,
 * like WebVTT's header or a `NOTE`, is skipped, and so is a number or name above the timing line.
 */
export const readTimed = (text: string): Array<Cue> =>
  text
    .replace(/\r\n?/gu, "\n")
    .split(/\n[^\S\n]*\n/u)
    .flatMap((block) => {
      const lines = block.split("\n")
      const at = lines.findIndex((line) => timingOf(line) !== undefined)
      return at === -1 ? [] : [{ ...timingOf(lines[at]!)!, text: plainText(lines.slice(at + 1).join("\n")) }]
    })
