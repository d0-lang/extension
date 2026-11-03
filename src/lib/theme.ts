/** Applies the stored theme to extension pages. */
import { getTheme, type Theme } from "./storage"

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)")

export const isDark = (theme: Theme): boolean =>
  theme === "dark" || (theme === "system" && darkQuery().matches)

/**
 * Keep `.dark` on `<html>` in step with the stored theme, and with the OS while it is `system`.
 * Resolves once the first theme is applied, so a page can mount without a flash.
 */
export const syncTheme = async (): Promise<void> => {
  let theme = await getTheme()
  const apply = () => {
    const dark = isDark(theme)
    document.documentElement.classList.toggle("dark", dark)
    // Native controls and scrollbars do not read the class.
    document.documentElement.style.colorScheme = dark ? "dark" : "light"
    // `public/theme-init.js` reads this before the next page paints.
    localStorage.setItem("theme", theme)
  }
  apply()

  darkQuery().addEventListener("change", apply)
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && "theme" in changes) {
      void getTheme().then((next) => {
        theme = next
        apply()
      })
    }
  })
}
