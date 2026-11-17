<script lang="ts">
  import { onMount } from "svelte"
  import { playableAudio } from "$lib/dict/entries"
  import { AudioPlayer } from "$lib/popover/audio.svelte"
  import EntryList from "$lib/popover/EntryList.svelte"
  import LanguageBar from "$lib/popover/LanguageBar.svelte"
  import type { MarkStyle } from "$lib/storage"
  import { cn } from "$lib/utils"
  import { LANGUAGE_KEYS, orderedLanguages } from "./languages"
  import { SAMPLE_ENTRIES, SAMPLE_LABELS, SAMPLE_LANGUAGES } from "./sample"

  /**
   * The lookup popover over a sample word, drawn by its own parts with the current settings.
   * Its footer has the bound languages in their order, and A, D and E work as on a page. The word stays English.
   */
  let {
    showIpa,
    markStyle,
    class: className,
  }: { showIpa: boolean; markStyle: MarkStyle; class?: string } = $props()

  const audio = new AudioPlayer()
  let languages = $state.raw<Array<string>>([])
  let picked = $state<string>()
  let preview = $state<HTMLElement>()
  /** The picked language while it is still in the footer. Otherwise English, or the first. */
  const shown = $derived(
    picked !== undefined && languages.includes(picked)
      ? picked
      : languages.includes("en_en")
        ? "en_en"
        : languages[0],
  )

  const load = async () => {
    const { order, paused } = await orderedLanguages()
    const active = order.filter((code) => !paused.includes(code))
    languages = active.length < 2 ? SAMPLE_LANGUAGES : active
  }

  /** Wraps around, like the popover's A and D. */
  const step = (by: 1 | -1) => {
    const index = shown === undefined ? -1 : languages.indexOf(shown)
    picked = languages[(index + by + languages.length) % languages.length]
  }

  const playFirst = () => {
    const url = SAMPLE_ENTRIES.map((entry) => playableAudio(entry, undefined)?.url).find(
      (found) => found !== undefined,
    )
    if (url !== undefined) {
      audio.play(url)
    }
  }

  /** The popover's keys while the preview shows, unless they are typed into a field or pressed with a modifier. */
  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target
    if (
      preview?.checkVisibility() !== true ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      (target instanceof HTMLElement &&
        (target.isContentEditable || target.closest("input, textarea, select")))
    ) {
      return
    }
    const action = { KeyA: () => step(-1), KeyD: () => step(1), KeyE: playFirst }[event.code]
    if (action !== undefined) {
      event.preventDefault()
      action()
    }
  }

  onMount(() => {
    void load()
    // Reordering below, or a server added in another tab, moves the footer's languages.
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area === "local" && LANGUAGE_KEYS.some((key) => key in changes)) {
        void load()
      }
    }
    browser.storage.onChanged.addListener(onChanged)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      browser.storage.onChanged.removeListener(onChanged)
      window.removeEventListener("keydown", onKeyDown)
      audio.stop()
    }
  })
</script>

<div bind:this={preview} class={cn("flex flex-col gap-2", className)}>
  <p class="text-muted-foreground text-sm">
    …last summer we visited my <mark
      class={[
        "text-foreground rounded-xs px-px",
        markStyle === "tint"
          ? "bg-link/15 dark:bg-link/30"
          : "decoration-link bg-transparent underline decoration-2 underline-offset-3",
      ]}>mother</mark
    > in Hamburg…
  </p>
  <!-- As `.dict-popover` sets it up on a page, with the system font a page's popover uses. -->
  <div
    class="bg-popover text-popover-foreground flex w-full flex-col rounded-lg border text-sm shadow-lg [--radius:7px] [font-family:ui-sans-serif,system-ui,sans-serif]"
    role="dialog"
    aria-label="Popover preview"
  >
    <div class="flex flex-col gap-2 px-3 py-2">
      <EntryList
        entries={SAMPLE_ENTRIES}
        language="en_en"
        server={undefined}
        labels={SAMPLE_LABELS}
        {showIpa}
        {audio}
        follow={() => {}}
      />
    </div>
    {#if languages.length > 1}
      <LanguageBar {languages} {shown} pick={(code) => (picked = code)} />
    {/if}
  </div>
</div>
