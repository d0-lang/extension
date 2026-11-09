/** Lookup toggle, YouTube subtitles, IPA toggle and theme. */

/** `system` follows the OS colour scheme. */
export type Theme = "system" | "light" | "dark"

const themes: ReadonlyArray<string> = ["system", "light", "dark"] satisfies Array<Theme>

const empty = {
  lookupEnabled: true,
  youtubeCaptions: true,
  pauseOnLookup: true,
  showIpa: true,
  theme: "system" as Theme,
}

export const getLookupEnabled = async (): Promise<boolean> => {
  const { lookupEnabled } = await browser.storage.local.get("lookupEnabled")
  return typeof lookupEnabled === "boolean" ? lookupEnabled : empty.lookupEnabled
}

export const setLookupEnabled = async (lookupEnabled: boolean): Promise<void> => {
  await browser.storage.local.set({ lookupEnabled })
}

/** Whether YouTube's subtitles are shown by the extension, two lines at a time and clickable. */
export const getYoutubeCaptions = async (): Promise<boolean> => {
  const { youtubeCaptions } = await browser.storage.local.get("youtubeCaptions")
  return typeof youtubeCaptions === "boolean" ? youtubeCaptions : empty.youtubeCaptions
}

export const setYoutubeCaptions = async (youtubeCaptions: boolean): Promise<void> => {
  await browser.storage.local.set({ youtubeCaptions })
}

/** Whether a video pauses while a word from its subtitles is looked up. */
export const getPauseOnLookup = async (): Promise<boolean> => {
  const { pauseOnLookup } = await browser.storage.local.get("pauseOnLookup")
  return typeof pauseOnLookup === "boolean" ? pauseOnLookup : empty.pauseOnLookup
}

export const setPauseOnLookup = async (pauseOnLookup: boolean): Promise<void> => {
  await browser.storage.local.set({ pauseOnLookup })
}

export const getShowIpa = async (): Promise<boolean> => {
  const { showIpa } = await browser.storage.local.get("showIpa")
  return typeof showIpa === "boolean" ? showIpa : empty.showIpa
}

export const setShowIpa = async (showIpa: boolean): Promise<void> => {
  await browser.storage.local.set({ showIpa })
}

export const getTheme = async (): Promise<Theme> => {
  const { theme } = await browser.storage.local.get("theme")
  return typeof theme === "string" && themes.includes(theme) ? (theme as Theme) : empty.theme
}

export const setTheme = async (theme: Theme): Promise<void> => {
  await browser.storage.local.set({ theme })
}
