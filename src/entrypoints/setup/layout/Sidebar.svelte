<script lang="ts">
  import { onMount } from "svelte"
  import BanIcon from "@lucide/svelte/icons/ban"
  import BugIcon from "@lucide/svelte/icons/bug"
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right"
  import KeyboardIcon from "@lucide/svelte/icons/keyboard"
  import PaletteIcon from "@lucide/svelte/icons/palette"
  import PlugIcon from "@lucide/svelte/icons/plug"
  import ServerIcon from "@lucide/svelte/icons/server"
  import { reportPagePath } from "$lib/report-page"
  import { cn } from "$lib/utils"
  import { blockedNote, serversNote } from "./notes"
  import { sectionGroups, type SectionId } from "./sections"
  import { Summary } from "./summary.svelte"

  /**
   * The sections, grouped. From `md` up it is the sidebar beside the open section, which `active` marks.
   * Below that it is a screen of its own, the one a phone opens on.
   */
  let { active, class: className }: { active: SectionId; class?: string } = $props()

  const icons: Record<SectionId, typeof ServerIcon> = {
    servers: ServerIcon,
    integrations: PlugIcon,
    sites: BanIcon,
    appearance: PaletteIcon,
    hotkeys: KeyboardIcon,
  }

  const groups = sectionGroups()
  const version = browser.runtime.getManifest().version
  const summary = new Summary()

  /** The line under a section's name, where it has one. Only Servers' line is a warning. */
  const notes = $derived<Partial<Record<SectionId, string>>>({
    servers: serversNote(summary.servers, summary.issues),
    sites: blockedNote(summary.blocked),
  })

  onMount(() => {
    void summary.load()
    return summary.watch()
  })
</script>

<nav
  class={cn("flex flex-col gap-5 px-4 py-5 md:gap-4 md:border-r md:bg-sidebar md:px-3 md:py-5", className)}
  aria-label="Settings"
>
  <h1 class="px-1 text-2xl font-semibold tracking-tight md:hidden">Settings</h1>
  {#each groups as { group, sections } (group)}
    <div class="flex flex-col gap-1.5 md:gap-0.5">
      <p class="text-muted-foreground px-1 text-xs font-medium md:px-2.5 md:pb-1">{group}</p>
      <ul
        class="divide-y overflow-hidden rounded-xl border md:divide-y-0 md:overflow-visible md:rounded-none md:border-0"
      >
        {#each sections as section (section.id)}
          {@const Icon = icons[section.id]}
          {@const note = notes[section.id]}
          {@const current = active === section.id}
          <li>
            <a
              href="#{section.id}"
              aria-current={current ? "page" : undefined}
              class={[
                "focus-visible:ring-ring flex min-h-14 items-center gap-3 px-3 py-2 outline-none focus-visible:ring-2 md:min-h-11 md:rounded-lg md:px-2.5 md:py-1.5",
                current ? "md:bg-accent" : "md:hover:bg-accent/60",
              ]}
            >
              <span
                class={[
                  "bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg md:bg-background md:border md:size-7.5",
                  current ? "md:text-foreground" : "md:text-muted-foreground",
                ]}
              >
                <Icon class="size-4" />
              </span>
              <span class="flex min-w-0 flex-1 flex-col leading-tight">
                <span class="text-sm font-medium">{section.label}</span>
                {#if note !== undefined}
                  <span
                    class={[
                      "truncate text-xs",
                      section.id === "servers" ? "text-destructive" : "text-muted-foreground",
                    ]}
                  >
                    {note}
                  </span>
                {/if}
              </span>
              <ChevronRightIcon class="text-muted-foreground size-4 shrink-0 md:hidden" />
            </a>
          </li>
        {/each}
      </ul>
    </div>
  {/each}
  <div class="text-muted-foreground mt-auto flex items-center justify-between gap-4 px-1 text-xs md:px-2.5">
    <a
      href={browser.runtime.getURL(reportPagePath(undefined))}
      target="_blank"
      class="hover:text-foreground inline-flex items-center gap-1.5"
    >
      <BugIcon class="size-3.5" />
      Report a problem
    </a>
    <span>{version}</span>
  </div>
</nav>
