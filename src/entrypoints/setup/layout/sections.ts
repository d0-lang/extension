/** The settings sections, in the sidebar's order. Each opens at its `#id`. */

export const sections = [
  { id: "servers", label: "Servers", group: "Dictionaries" },
  { id: "integrations", label: "Integrations", group: "Sites" },
  { id: "sites", label: "Blocked sites", group: "Sites" },
  { id: "appearance", label: "Appearance", group: "Display" },
  { id: "subtitles", label: "Subtitles", group: "Display" },
  { id: "hotkeys", label: "Hotkeys", group: "Display" },
] as const

export type SectionId = (typeof sections)[number]["id"]

/** Shown beside the sidebar when the address names no section. */
export const FIRST_SECTION: SectionId = "servers"

/** The section a `location.hash` like `#servers` names. Unset for none, which a phone shows as the list of sections. */
export const sectionOf = (hash: string): SectionId | undefined =>
  sections.find((section) => `#${section.id}` === hash)?.id

/** The sections under each group's name, in order. */
export const sectionGroups = (): Array<{ group: string; sections: Array<(typeof sections)[number]> }> =>
  sections.reduce<Array<{ group: string; sections: Array<(typeof sections)[number]> }>>((groups, section) => {
    const last = groups.at(-1)
    if (last?.group === section.group) {
      last.sections.push(section)
    } else {
      groups.push({ group: section.group, sections: [section] })
    }
    return groups
  }, [])
