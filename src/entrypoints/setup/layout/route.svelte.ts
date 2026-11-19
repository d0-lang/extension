import { sectionOf, type SectionId } from "./sections"

/** The window scrolls, except from `xl` up, where the section scrolls inside the page's card. */
const scrollToTop = () => {
  window.scrollTo({ top: 0 })
  document.querySelector("main")?.scrollTo({ top: 0 })
}

/** The section the address's hash names, kept in step as it changes. */
export class Route {
  section = $state<SectionId | undefined>(sectionOf(location.hash))
  /** Whether the open section was opened from the list, so the entry before it in history is the list. */
  #fromList = false

  watch = (): (() => void) => {
    const onHashChange = () => {
      const next = sectionOf(location.hash)
      this.#fromList = this.section === undefined && next !== undefined
      this.section = next
      // A section opens at its top, not where the last one was scrolled to.
      scrollToTop()
    }
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }

  /**
   * Back to the list without adding to history, so the browser's own Back then leaves settings.
   * A section opened straight from a link has no list behind it, so its entry becomes the list instead.
   */
  toList = () => {
    if (this.#fromList) {
      history.back()
      return
    }
    history.replaceState(null, "", location.pathname + location.search)
    this.section = undefined
    scrollToTop()
  }
}
