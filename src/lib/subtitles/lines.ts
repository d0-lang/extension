/** Lines of subtitle text, and the wide characters that join them without a space. */

/** East Asian wide and fullwidth characters. */
export const WIDE =
  /[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua960-\ua97f\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/u

/** What joins two lines: a space, or nothing between two wide characters. */
export const joint = (before: string, after: string): string =>
  WIDE.test(before.at(-1) ?? "") && WIDE.test(after[0] ?? "") ? "" : " "

/** Joins text across a line break. */
export const joinLines = (text: string): string =>
  text.replace(
    /(.?)[^\S\n]*\n\s*(.?)/gu,
    (_, before: string, after: string) => before + joint(before, after) + after,
  )
