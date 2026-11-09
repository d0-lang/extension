// Runs before first paint, so a dark page does not flash white while `browser.storage` is read.
// `syncTheme` in `src/lib/theme.ts` keeps this cached copy up to date.
{
  const theme = localStorage.getItem("theme") ?? "system"
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", dark)
  document.documentElement.style.colorScheme = dark ? "dark" : "light"
}
