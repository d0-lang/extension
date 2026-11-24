<script lang="ts">
  import CaptionsIcon from "@lucide/svelte/icons/captions"
  import CheckIcon from "@lucide/svelte/icons/check"
  import UploadIcon from "@lucide/svelte/icons/upload"
  import { languageName } from "$lib/languages"
  import ChooseFiles from "../open/ChooseFiles.svelte"
  import { languageInName } from "../open/language"
  import type { FileTrack } from "../open/subtitles"
  import { keepFocus } from "./keys"

  /**
   * The subtitles button, named after the language showing, with a menu of the subtitle files and a way to open
   * another. It is drawn in the player, so it shows in fullscreen too.
   */
  let {
    track,
    subtitleFiles,
    hidden,
    onFiles,
    onPickSubtitles,
  }: {
    track: FileTrack | undefined
    subtitleFiles: ReadonlyArray<File>
    /** The controls faded out, which closes the menu. */
    hidden: boolean
    onFiles: (files: Iterable<File>) => void
    onPickSubtitles: (file: File) => void
  } = $props()

  let open = $state(false)
  let menu: HTMLDivElement | undefined = $state()

  $effect(() => {
    if (hidden) {
      open = false
    }
  })

  const languageOf = (name: string): string | undefined =>
    name === track?.name ? track.lang || undefined : languageInName(name)

  const label = (lang: string | undefined): string =>
    lang === undefined ? "Language unknown" : languageName(lang)

  const item =
    "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-white/15"
</script>

<svelte:window
  onpointerdown={(event) => {
    if (open && menu !== undefined && !event.composedPath().includes(menu)) {
      open = false
    }
  }}
  onkeydown={(event) => {
    if (open && event.key === "Escape") {
      open = false
    }
  }}
/>

<ChooseFiles {onFiles} accept=".srt,.vtt,.ass,.ssa">
  {#snippet button(choose)}
    <div bind:this={menu} class="relative">
      <button
        type="button"
        class="flex h-9 max-w-56 shrink-0 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-white/15"
        aria-haspopup="menu"
        aria-expanded={open}
        onmousedown={keepFocus}
        onclick={() => {
          if (subtitleFiles.length === 0) {
            choose()
          } else {
            open = !open
          }
        }}
      >
        <CaptionsIcon class="size-5 shrink-0" />
        <span class="truncate">
          {track === undefined ? "Add subtitles" : label(track.lang || undefined)}
        </span>
      </button>
      {#if open}
        <div
          role="menu"
          class="absolute right-0 bottom-full mb-2 flex w-72 flex-col rounded-lg bg-neutral-900/95 p-1 text-sm shadow-lg ring-1 ring-white/10"
        >
          {#each subtitleFiles as file (file.name)}
            <button
              type="button"
              role="menuitemradio"
              aria-checked={file.name === track?.name}
              class={item}
              title={file.name}
              onmousedown={keepFocus}
              onclick={() => {
                open = false
                onPickSubtitles(file)
              }}
            >
              <CheckIcon class={["size-4 shrink-0", file.name !== track?.name && "invisible"]} />
              <span class="flex min-w-0 flex-col">
                <span class="font-medium">{label(languageOf(file.name))}</span>
                <span class="truncate text-xs opacity-60">{file.name}</span>
              </span>
            </button>
          {/each}
          <div class="my-1 h-px bg-white/10"></div>
          <button
            type="button"
            role="menuitem"
            class={item}
            onmousedown={keepFocus}
            onclick={() => {
              open = false
              choose()
            }}
          >
            <UploadIcon class="size-4 shrink-0" />
            Open subtitle file…
          </button>
        </div>
      {/if}
    </div>
  {/snippet}
</ChooseFiles>
