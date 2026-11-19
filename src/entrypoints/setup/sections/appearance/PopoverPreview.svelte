<script lang="ts">
  import { onMount } from "svelte"
  import type { ClassValue } from "svelte/elements"
  import { entriesForLemma, playableAudio } from "$lib/dict/entries"
  import { sourceLinks, type SourceLink } from "$lib/dict/sources"
  import { AudioPlayer } from "$lib/popover/audio.svelte"
  import BackBar from "$lib/popover/BackBar.svelte"
  import EntryList from "$lib/popover/EntryList.svelte"
  import LanguageBar from "$lib/popover/LanguageBar.svelte"
  import SourceList from "$lib/popover/SourceList.svelte"
  import SourcesButton from "$lib/popover/SourcesButton.svelte"
  import type { MarkStyle } from "$lib/storage"
  import { cn } from "$lib/utils"
  import { LANGUAGE_KEYS, orderedLanguages } from "./languages"
  import { SAMPLE_ENTRIES, SAMPLE_LABELS, SAMPLE_LANGUAGES, SAMPLE_SOURCES, SAMPLE_WORD } from "./sample"

  /**
   * The lookup popover over a sample word, drawn by its own parts with the current settings.
   * Its footer has the bound languages in their order, and Shift + A, Shift + D and E work as on a page.
   * The sample word has no parts, so A and D without Shift do nothing. The words stay English.
   * A `see` link, Back and Sources move between views as the popover does, within the sample.
   */
  let {
    showIpa,
    markStyle,
    class: className,
  }: { showIpa: boolean; markStyle: MarkStyle; class?: ClassValue } = $props()

  /** `sources` shows those links instead of the word's entries. */
  type View = { word: string; sources?: Array<SourceLink> }

  const audio = new AudioPlayer()
  let view = $state.raw<View>({ word: SAMPLE_WORD })
  let history = $state.raw<Array<View>>([])
  const entries = $derived(entriesForLemma(SAMPLE_ENTRIES, view.word))
  const links = $derived(sourceLinks(entries, SAMPLE_SOURCES, "en_en"))
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

  /** Wraps around, like the popover's Shift + A and Shift + D. */
  const step = (by: 1 | -1) => {
    const index = shown === undefined ? -1 : languages.indexOf(shown)
    picked = languages[(index + by + languages.length) % languages.length]
  }

  const open = (next: View) => {
    history = [...history, view]
    view = next
  }

  const goBack = () => {
    view = history.at(-1) ?? view
    history = history.slice(0, -1)
  }

  /** The first recording in view, as E plays on a page. */
  const playFirst = () => {
    const url = entries
      .map((entry) => playableAudio(entry, undefined)?.url)
      .find((found) => found !== undefined)
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
    const action = {
      KeyA: event.shiftKey ? () => step(-1) : undefined,
      KeyD: event.shiftKey ? () => step(1) : undefined,
      KeyE: () => view.sources === undefined && playFirst(),
    }[event.code]
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

<!-- Hidden until the footer's languages are read, so it does not grow a footer after showing. -->
<div
  bind:this={preview}
  class={cn("flex w-85 max-w-full flex-col gap-2", languages.length === 0 && "invisible", className)}
>
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
    class="dict-popover bg-popover text-popover-foreground flex w-full flex-col rounded-lg border text-sm shadow-lg [--radius:7px] [font-family:ui-sans-serif,system-ui,sans-serif]"
    role="dialog"
    aria-label="Popover preview"
  >
    {#if history.length > 0}
      <BackBar back={goBack} />
    {/if}
    {#if view.sources !== undefined}
      <div class="flex flex-col px-3 py-2">
        <SourceList links={view.sources} />
      </div>
    {:else if entries.length === 0}
      <p class="text-muted-foreground px-3 py-2 wrap-anywhere">No entries for {view.word} in this preview.</p>
    {:else}
      <div class="flex flex-col gap-2 px-3 py-2">
        <div class="relative flex flex-col gap-2">
          <EntryList
            {entries}
            language="en_en"
            server={undefined}
            labels={SAMPLE_LABELS}
            {showIpa}
            {audio}
            follow={(target) => open({ word: target })}
            reserveEnd={links.length > 0}
          />
          {#if links.length > 0}
            <SourcesButton open={() => open({ ...view, sources: links })} />
          {/if}
        </div>
      </div>
    {/if}
    {#if languages.length > 1 && view.sources === undefined}
      <LanguageBar {languages} {shown} pick={(code) => (picked = code)} />
    {/if}
  </div>
</div>
