<script lang="ts">
  import { AudioPlayer } from "$lib/popover/audio.svelte"
  import EntryList from "$lib/popover/EntryList.svelte"
  import LanguageBar from "$lib/popover/LanguageBar.svelte"
  import SourcesButton from "$lib/popover/SourcesButton.svelte"
  import type { MarkStyle } from "$lib/storage"
  import { cn } from "$lib/utils"
  import { SAMPLE_ENTRIES, SAMPLE_LANGUAGES, SAMPLE_SERVER } from "./sample"

  /**
   * The lookup popover over a sample word, drawn by its own parts with the current settings.
   * Only to look at, so nothing in it reacts to the pointer or the keyboard.
   */
  let {
    showIpa,
    markStyle,
    class: className,
  }: { showIpa: boolean; markStyle: MarkStyle; class?: string } = $props()

  const audio = new AudioPlayer()
</script>

<div class={cn("flex flex-col gap-2", className)} inert>
  <p class="text-muted-foreground text-sm">
    …besuchten wir meine <mark
      class={[
        "text-foreground rounded-xs px-px",
        markStyle === "tint"
          ? "bg-link/15 dark:bg-link/30"
          : "decoration-link bg-transparent underline decoration-2 underline-offset-3",
      ]}>Mutter</mark
    > in Hamburg…
  </p>
  <!-- As `.dict-popover` sets it up on a page, with the system font a page's popover uses. -->
  <div
    class="bg-popover text-popover-foreground flex w-full flex-col rounded-lg border text-sm shadow-lg [--radius:7px] [font-family:ui-sans-serif,system-ui,sans-serif]"
  >
    <div class="flex flex-col gap-2 px-3 py-2">
      <div class="relative flex flex-col gap-2">
        <EntryList
          entries={SAMPLE_ENTRIES}
          language="de_en"
          server={SAMPLE_SERVER}
          labels={{}}
          {showIpa}
          {audio}
          follow={() => {}}
          reserveEnd
        />
        <SourcesButton open={() => {}} />
      </div>
    </div>
    <LanguageBar languages={SAMPLE_LANGUAGES} shown="de_en" pick={() => {}} />
  </div>
</div>
