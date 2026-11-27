<script lang="ts">
  import { onMount } from "svelte"
  import { AudioPlayer } from "$lib/popover/audio.svelte"
  import EntryList from "$lib/popover/EntryList.svelte"
  import { SAMPLE_ENTRIES, samplePieces } from "./sample"

  /**
   * The sample sentence, where Alt over a word opens a popover with its made-up entries, as on a page. A click or a
   * tap opens it too, since this page has no long-press button. `looked` is called on every word opened.
   */
  let { looked }: { looked: () => void } = $props()

  const pieces = samplePieces()
  const audio = new AudioPlayer()
  let box = $state<HTMLElement>()
  /** The word open, and where its popover goes inside the box. */
  let open = $state<{ word: string; index: number; left: number; top: number }>()

  const show = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement) || box === undefined) {
      return
    }
    const span = target.closest<HTMLElement>("[data-word]")
    const index = Number(span?.dataset.index)
    if (span === null || span.dataset.word === undefined || open?.index === index) {
      return
    }
    const outer = box.getBoundingClientRect()
    const rect = span.getBoundingClientRect()
    open = {
      word: span.dataset.word,
      index,
      // Kept inside the box, which is narrower than a page on a phone.
      left: Math.max(0, Math.min(rect.left - outer.left, outer.width - 300)),
      top: rect.bottom - outer.top + 6,
    }
    looked()
  }

  const close = () => {
    open = undefined
    audio.stop()
  }

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close()
      }
    }
    // Firefox can open its menu bar when Alt is released.
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "AltLeft" && open !== undefined) {
        event.preventDefault()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      audio.stop()
    }
  })
</script>

<div
  bind:this={box}
  class="relative rounded-lg border border-dashed px-4 py-3 text-lg select-none"
  role="presentation"
  onpointermove={(event) => {
    if (event.altKey) {
      show(event.target)
    }
  }}
  onclick={(event) => show(event.target)}
  onpointerleave={close}
>
  <p>
    {#each pieces as piece, index (index)}{#if piece.word === undefined}{piece.text}{:else}<span
          data-word={piece.word}
          data-index={index}
          class={["cursor-default rounded-xs", open?.index === index && "bg-link/15 dark:bg-link/30"]}
          >{piece.text}</span
        >{/if}{/each}
  </p>
  {#if open !== undefined}
    <!-- As `.dict-popover` sets it up on a page, with the system font a page's popover uses. -->
    <div
      class="bg-popover text-popover-foreground absolute z-10 flex w-75 max-w-full flex-col rounded-lg border text-sm shadow-lg [--radius:7px] [font-family:ui-sans-serif,system-ui,sans-serif]"
      style:left="{open.left}px"
      style:top="{open.top}px"
      role="dialog"
      aria-label="Sample lookup"
    >
      <div class="flex flex-col gap-2 px-3 py-2">
        <EntryList
          entries={SAMPLE_ENTRIES[open.word] ?? []}
          language="en_en"
          server={undefined}
          labels={{}}
          showIpa
          {audio}
          follow={() => {}}
        />
      </div>
    </div>
  {/if}
</div>
