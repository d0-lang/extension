import { firefoxInfo } from "$lib/firefox"

/** The first Firefox that draws a highlight's underline. */
const FIRST_UNDERLINING_FIREFOX = 146

/** Whether a Firefox `version`, like `145.0.1`, draws a highlight's underline. */
export const firefoxUnderlines = (version: string): boolean =>
  Number.parseInt(version, 10) >= FIRST_UNDERLINING_FIREFOX

/** Whether this browser draws the underline mark style. Every Chrome the extension runs on does. */
export const canUnderline = async (): Promise<boolean> => {
  const firefox = await firefoxInfo().catch(() => undefined)
  return firefox === undefined || firefoxUnderlines(firefox.version)
}
