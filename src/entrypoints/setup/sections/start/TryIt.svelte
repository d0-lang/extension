<script lang="ts">
  import { onMount } from "svelte"
  import { AudioPlayer } from "$lib/popover/audio.svelte"
  import EntryList from "$lib/popover/EntryList.svelte"
  import { SAMPLE_ENTRIES, samplePieces } from "./sample"

  /**
   * The sample sentence, where holding Alt over a word opens a popover with its made-up entries, as on a page, and
   * letting go closes it unless the pointer is on it. A mouse click does nothing, as on a page, but a tap opens it, as
   * this page has no Look up button for a phone to press. `looked` is called on every word opened.
   */
  let { looked }: { looked: () => void } = $props()

  const pieces = samplePieces()
  const audio = new AudioPlayer()
  let box = $state<HTMLElement>()
  let popover = $state<HTMLElement>()
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
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "AltLeft") {
        return
      }
      // Firefox opens its menu bar when Alt is let go, which a page's content script stops but nothing does here.
      event.preventDefault()
      if (open !== undefined && popover?.matches(":hover") !== true) {
        close()
      }
    }
    // A tap outside closes it, as a finger never leaves the box the way a mouse does.
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && box?.contains(event.target) !== true) {
        close()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("pointerdown", onPointerDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("pointerdown", onPointerDown)
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
  onpointerleave={(event) => {
    // A finger leaves as it lifts, which would close what the tap just opened.
    if (event.pointerType !== "touch") {
      close()
    }
  }}
  onpointerup={(event) => {
    if (event.pointerType === "touch") {
      show(event.target)
    }
  }}
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
      bind:this={popover}
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
