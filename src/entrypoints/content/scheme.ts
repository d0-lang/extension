/** Below this, white contrasts more than black does. */
const DARK_LUMINANCE = 0.179

/** Half-transparent layers let too much of what is behind them through to judge by. */
const MIN_ALPHA = 0.5

let probe: CanvasRenderingContext2D | null | undefined

/** Any CSS colour as sRGB bytes, because Chrome keeps `oklch()` and friends as written in computed styles. */
const toRgba = (color: string): Uint8ClampedArray | undefined => {
  probe ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", {
    willReadFrequently: true,
  })
  if (probe === null) {
    return undefined
  }
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = color
  probe.fillRect(0, 0, 1, 1)
  return probe.getImageData(0, 0, 1, 1).data
}

const channel = (byte: number): number => {
  const value = byte / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

const luminance = ([r = 0, g = 0, b = 0]: Uint8ClampedArray): number =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

/** With no background anywhere, the browser paints the canvas from the root's `color-scheme`. */
const canvasIsDark = (): boolean => {
  const schemes = getComputedStyle(document.documentElement).colorScheme.split(/\s+/)
  return (
    schemes.includes("dark") &&
    (!schemes.includes("light") || matchMedia("(prefers-color-scheme: dark)").matches)
  )
}

/** Whether the page is dark behind `element`, judged by the nearest solid background up the tree. */
export const isDarkBehind = (element: Element | null): boolean => {
  for (let current = element; current !== null; current = current.parentElement) {
    const rgba = toRgba(getComputedStyle(current).backgroundColor)
    if (rgba !== undefined && (rgba[3] ?? 0) / 255 >= MIN_ALPHA) {
      return luminance(rgba) < DARK_LUMINANCE
    }
  }
  return canvasIsDark()
}
