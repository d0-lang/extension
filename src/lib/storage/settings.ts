/** Lookup toggle, YouTube subtitles and how subtitles show, IPA toggle, theme and how the looked-up word is marked. */

/** `system` follows the OS colour scheme. */
export type Theme = "system" | "light" | "dark"

const themes: ReadonlyArray<string> = ["system", "light", "dark"] satisfies Array<Theme>

/** How the looked-up word is marked on the page: a tinted background or an underline. */
export type MarkStyle = "tint" | "underline"

const markStyles: ReadonlyArray<string> = ["tint", "underline"] satisfies Array<MarkStyle>

/** Where subtitles start in the player, before a drag moves them. */
export type SubtitlePosition = "bottom" | "top"

const subtitlePositions: ReadonlyArray<string> = ["bottom", "top"] satisfies Array<SubtitlePosition>

/** How subtitles show on every site the extension draws them on. */
export type SubtitleSettings = {
  /** Whether the row the cue before ended on shows above the cue. */
  previous: boolean
  /** Whether that row slides up when the next cue starts. */
  slide: boolean
  position: SubtitlePosition
  /** Whether a creator's colours, italics and places show. */
  creator: boolean
}

const empty = {
  lookupEnabled: true,
  youtubeCaptions: true,
  subtitles: { previous: true, slide: true, position: "bottom", creator: true } as SubtitleSettings,
  showIpa: true,
  theme: "system" as Theme,
  markStyle: "tint" as MarkStyle,
}

export const getLookupEnabled = async (): Promise<boolean> => {
  const { lookupEnabled } = await browser.storage.local.get("lookupEnabled")
  return typeof lookupEnabled === "boolean" ? lookupEnabled : empty.lookupEnabled
}

export const setLookupEnabled = async (lookupEnabled: boolean): Promise<void> => {
  await browser.storage.local.set({ lookupEnabled })
}

/** Whether YouTube's subtitles are shown by the extension, with the one before above and each word clickable. */
export const getYoutubeCaptions = async (): Promise<boolean> => {
  const { youtubeCaptions } = await browser.storage.local.get("youtubeCaptions")
  return typeof youtubeCaptions === "boolean" ? youtubeCaptions : empty.youtubeCaptions
}

export const setYoutubeCaptions = async (youtubeCaptions: boolean): Promise<void> => {
  await browser.storage.local.set({ youtubeCaptions })
}

/** How subtitles show until the settings are read. */
export const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = empty.subtitles

/** The storage keys of the subtitle settings, to reload when one changes. */
export const SUBTITLE_KEYS = ["subtitlePrevious", "subtitleSlide", "subtitlePosition", "subtitleCreator"]

export const getSubtitleSettings = async (): Promise<SubtitleSettings> => {
  const { subtitlePrevious, subtitleSlide, subtitlePosition, subtitleCreator } =
    await browser.storage.local.get(SUBTITLE_KEYS)
  return {
    previous: typeof subtitlePrevious === "boolean" ? subtitlePrevious : empty.subtitles.previous,
    slide: typeof subtitleSlide === "boolean" ? subtitleSlide : empty.subtitles.slide,
    position:
      typeof subtitlePosition === "string" && subtitlePositions.includes(subtitlePosition)
        ? (subtitlePosition as SubtitlePosition)
        : empty.subtitles.position,
    creator: typeof subtitleCreator === "boolean" ? subtitleCreator : empty.subtitles.creator,
  }
}

export const setSubtitleCreator = async (subtitleCreator: boolean): Promise<void> => {
  await browser.storage.local.set({ subtitleCreator })
}

export const setSubtitlePrevious = async (subtitlePrevious: boolean): Promise<void> => {
  await browser.storage.local.set({ subtitlePrevious })
}

export const setSubtitleSlide = async (subtitleSlide: boolean): Promise<void> => {
  await browser.storage.local.set({ subtitleSlide })
}

export const setSubtitlePosition = async (subtitlePosition: SubtitlePosition): Promise<void> => {
  await browser.storage.local.set({ subtitlePosition })
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

export const getMarkStyle = async (): Promise<MarkStyle> => {
  const { markStyle } = await browser.storage.local.get("markStyle")
  return typeof markStyle === "string" && markStyles.includes(markStyle)
    ? (markStyle as MarkStyle)
    : empty.markStyle
}

export const setMarkStyle = async (markStyle: MarkStyle): Promise<void> => {
  await browser.storage.local.set({ markStyle })
}
