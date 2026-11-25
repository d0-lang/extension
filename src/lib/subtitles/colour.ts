/** Colours subtitles are drawn in, made readable on their near-black background. */

/** OKLCH lightness below which text does not stand out from the background. */
const MIN_LIGHTNESS = 0.72

/** Chroma below which a colour is a grey, which lightened would only be a dim white. */
const MIN_CHROMA = 0.04

/** Chroma a lightened colour keeps at most, since more would leave the screen's colours and shift its hue. */
const MAX_CHROMA = 0.2

const linear = (part: number): number => (part <= 0.040_45 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4)

/** `#rrggbb` in OKLCH, with `h` in degrees, after Björn Ottosson's OKLab. Nothing for another way of writing a colour. */
export const oklchOf = (colour: string): { l: number; c: number; h: number } | undefined => {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/iu.exec(colour)
  if (hex === null) {
    return undefined
  }
  const [r, g, b] = hex.slice(1).map((part) => linear(parseInt(part, 16) / 255)) as [number, number, number]
  const l = Math.cbrt(0.412_221_470_8 * r + 0.536_332_536_3 * g + 0.051_445_992_9 * b)
  const m = Math.cbrt(0.211_903_498_2 * r + 0.680_699_545_1 * g + 0.107_396_956_6 * b)
  const s = Math.cbrt(0.088_302_461_9 * r + 0.281_718_837_6 * g + 0.629_978_700_5 * b)
  const a = 1.977_998_495_1 * l - 2.428_592_205 * m + 0.450_593_709_9 * s
  const bb = 0.025_904_037_1 * l + 0.782_771_766_2 * m - 0.808_675_766 * s
  return {
    l: 0.210_454_255_3 * l + 0.793_617_785 * m - 0.004_072_046_8 * s,
    c: Math.hypot(a, bb),
    h: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360,
  }
}

/**
 * `colour`, lightened to stand out from the subtitles' background when it is too dark to, with its hue kept. A dark
 * grey has no hue to keep, so it gives nothing, and the text stays white. A colour written another way is kept.
 */
export const readableColour = (colour: string): string | undefined => {
  const lch = oklchOf(colour)
  if (lch === undefined || lch.l >= MIN_LIGHTNESS) {
    return colour
  }
  if (lch.c < MIN_CHROMA) {
    return undefined
  }
  return `oklch(${MIN_LIGHTNESS} ${Math.min(lch.c, MAX_CHROMA).toFixed(3)} ${lch.h.toFixed(1)})`
}
