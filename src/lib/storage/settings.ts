/** Lookup toggle, IPA toggle and theme. */

/** `system` follows the OS colour scheme. */
export type Theme = "system" | "light" | "dark"

const themes: ReadonlyArray<string> = ["system", "light", "dark"] satisfies Array<Theme>

const empty = {
  lookupEnabled: true,
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
