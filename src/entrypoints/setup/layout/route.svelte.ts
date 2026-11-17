import { sectionOf, type SectionId } from "./sections"

/** The section the address's hash names, kept in step as it changes. */
export class Route {
  section = $state<SectionId | undefined>(sectionOf(location.hash))

  watch = (): (() => void) => {
    const onHashChange = () => {
      this.section = sectionOf(location.hash)
      // A section opens at its top, not where the last one was scrolled to.
      window.scrollTo({ top: 0 })
    }
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }
}
