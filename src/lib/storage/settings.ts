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
  /** Whether a track whose cues mostly change within a couple of seconds shows without the slide. */
  calm: boolean
  position: SubtitlePosition
  /** Whether the colours, italics and places subtitles come with show. */
  styles: boolean
}

const empty = {
  lookupEnabled: true,
  youtubeCaptions: true,
  videoSubtitles: true,
  subtitles: {
    previous: true,
    slide: true,
    calm: true,
    position: "bottom",
    styles: true,
  } as SubtitleSettings,
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
export const SUBTITLE_KEYS = [
  "subtitlePrevious",
  "subtitleSlide",
  "subtitleCalm",
  "subtitlePosition",
  "subtitleStyles",
]

export const getSubtitleSettings = async (): Promise<SubtitleSettings> => {
  const { subtitlePrevious, subtitleSlide, subtitleCalm, subtitlePosition, subtitleStyles } =
    await browser.storage.local.get(SUBTITLE_KEYS)
  return {
    previous: typeof subtitlePrevious === "boolean" ? subtitlePrevious : empty.subtitles.previous,
    slide: typeof subtitleSlide === "boolean" ? subtitleSlide : empty.subtitles.slide,
    calm: typeof subtitleCalm === "boolean" ? subtitleCalm : empty.subtitles.calm,
    position:
      typeof subtitlePosition === "string" && subtitlePositions.includes(subtitlePosition)
        ? (subtitlePosition as SubtitlePosition)
        : empty.subtitles.position,
    styles: typeof subtitleStyles === "boolean" ? subtitleStyles : empty.subtitles.styles,
  }
}

export const setSubtitleStyles = async (subtitleStyles: boolean): Promise<void> => {
  await browser.storage.local.set({ subtitleStyles })
}

export const setSubtitlePrevious = async (subtitlePrevious: boolean): Promise<void> => {
  await browser.storage.local.set({ subtitlePrevious })
}

export const setSubtitleSlide = async (subtitleSlide: boolean): Promise<void> => {
  await browser.storage.local.set({ subtitleSlide })
}

export const setSubtitleCalm = async (subtitleCalm: boolean): Promise<void> => {
  await browser.storage.local.set({ subtitleCalm })
}

export const setSubtitlePosition = async (subtitlePosition: SubtitlePosition): Promise<void> => {
  await browser.storage.local.set({ subtitlePosition })
}

/** Whether the extension shows the subtitles of videos on other sites, from the tracks they give the browser. */
export const getVideoSubtitles = async (): Promise<boolean> => {
  const { videoSubtitles } = await browser.storage.local.get("videoSubtitles")
  return typeof videoSubtitles === "boolean" ? videoSubtitles : empty.videoSubtitles
}

export const setVideoSubtitles = async (videoSubtitles: boolean): Promise<void> => {
  await browser.storage.local.set({ videoSubtitles })
}

/** Sites whose players download their subtitle files, which the extension reads to show them, each with its switch. */
export type SubtitleSite = "ard" | "zdf" | "arte"

/** The storage key of `site`'s switch. */
export const siteSubtitlesKey = (site: SubtitleSite): string => `${site}Subtitles`

/** Whether the extension shows `site`'s subtitles in place of its own. On until the viewer turns it off. */
export const getSiteSubtitles = async (site: SubtitleSite): Promise<boolean> => {
  const key = siteSubtitlesKey(site)
  const value = (await browser.storage.local.get(key))[key]
  return typeof value === "boolean" ? value : true
}

export const setSiteSubtitles = async (site: SubtitleSite, on: boolean): Promise<void> => {
  await browser.storage.local.set({ [siteSubtitlesKey(site)]: on })
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
