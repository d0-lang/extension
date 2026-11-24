/** The text of a cue as subtitle files mark it up, like WebVTT and SRT. */

/** Entities a cue's text may hold, as WebVTT writes them. */
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
  "&lrm;": "‎",
  "&rlm;": "‏",
}

/**
 * A cue's text without its tags, like `<i>`, a speaker's `<v Anna>` or the `{\an8}` SRT files take from ASS, with one
 * space between words and no empty lines.
 */
export const plainText = (text: string): string =>
  text
    .replace(/<[^>]*>/gu, "")
    .replace(/\{\\[^}]*\}/gu, "")
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp|lrm|rlm);/gu, (entity) => ENTITIES[entity]!)
    .split("\n")
    .map((line) => line.replace(/\s+/gu, " ").trim())
    .filter((line) => line !== "")
    .join("\n")
