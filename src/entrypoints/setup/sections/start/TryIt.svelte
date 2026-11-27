<script lang="ts">
  import { onMount } from "svelte"
  import { AudioPlayer } from "$lib/popover/audio.svelte"
  import EntryList from "$lib/popover/EntryList.svelte"
  import { SAMPLE_ENTRIES, samplePieces } from "./sample"

  /**
   * The sample sentence, where a word opens a popover with its made-up entries the way it does on a page: Alt held
   * over it, which closes as Alt is let go unless the pointer is on it, or on a phone a long press and the Look up
   * button under it. A page's content script does not run here, so this does both itself. `looked` is called on every
   * word opened.
   */
  let { looked }: { looked: () => void } = $props()

  const pieces = samplePieces()
  const audio = new AudioPlayer()
  let box = $state<HTMLElement>()
  let popover = $state<HTMLElement>()
  /** What the pointer is over in the box, for Alt to open when it goes down. */
  let hovered: EventTarget | null = null
  /** The word open, and where its popover goes inside the box. */
  let open = $state<{ word: string; index: number; left: number; top: number }>()
  /** The word a long press selected, and where its Look up button goes inside the box. */
  let offer = $state<{ span: HTMLElement; centre: number; top: number }>()

  /** As on a page: the selection's handles sit under it, and the button and popover go below them. */
  const HANDLES_PX = 28
  /** As on a page: the button waits for the selection to stop changing, like when a handle is dragged. */
  const SETTLE_MS = 300

  /** Opens `target`'s word below it, and below the selection's handles after a long press. */
  const show = (target: EventTarget | null, gap = 6) => {
    if (!(target instanceof Element) || box === undefined) {
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
      top: rect.bottom - outer.top + gap,
    }
    looked()
  }

  const close = () => {
    open = undefined
    audio.stop()
  }

  /** The sample word a touch selected, alone, once the selection settles. */
  const offerSelected = () => {
    const selection = getSelection()
    const node = selection?.anchorNode
    const span = (node instanceof Element ? node : node?.parentElement)?.closest<HTMLElement>("[data-word]")
    if (
      selection === null ||
      selection.isCollapsed ||
      span === null ||
      span === undefined ||
      box?.contains(span) !== true ||
      selection.toString().trim().toLowerCase() !== span.dataset.word
    ) {
      return
    }
    const outer = box.getBoundingClientRect()
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    offer = {
      span,
      centre: (rect.left + rect.right) / 2 - outer.left,
      top: rect.bottom - outer.top + HANDLES_PX,
    }
  }

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close()
      }
      // A word already under the pointer opens as Alt goes down, without the pointer having to move.
      if (event.code === "AltLeft" && !event.repeat) {
        show(hovered)
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
    let touching = false
    // A tap outside closes it, as a finger never leaves the box the way a mouse does.
    const onPointerDown = (event: PointerEvent) => {
      touching = event.pointerType === "touch"
      if (event.target instanceof Node && box?.contains(event.target) !== true) {
        close()
      }
    }
    let settle: ReturnType<typeof setTimeout> | undefined
    // Only a touch selection gets the button, as on a page, where a mouse has Alt instead.
    const onSelectionChange = () => {
      offer = undefined
      clearTimeout(settle)
      settle = setTimeout(() => {
        if (touching) {
          offerSelected()
        }
      }, SETTLE_MS)
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("selectionchange", onSelectionChange)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("selectionchange", onSelectionChange)
      clearTimeout(settle)
      audio.stop()
    }
  })
</script>

<div
  bind:this={box}
  class="relative rounded-lg border border-dashed px-4 py-3 text-lg pointer-fine:select-none"
  role="presentation"
  onpointermove={(event) => {
    hovered = event.target
    if (event.altKey) {
      show(event.target)
    }
  }}
  onpointerleave={(event) => {
    hovered = null
    // A finger leaves as it lifts, which would close what the tap just opened.
    if (event.pointerType !== "touch") {
      close()
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
  {#if offer !== undefined}
    {@const offered = offer}
    <!-- As a page's Look up button looks. A press on it must not end the selection. -->
    <button
      type="button"
      class="absolute z-10 -translate-x-1/2 cursor-pointer rounded-full bg-[#1c1c1c] px-3.5 py-2 text-sm leading-none font-medium text-white shadow-[0_2px_8px_rgb(0_0_0/0.3)] [font-family:system-ui,sans-serif]"
      style:left="{offered.centre}px"
      style:top="{offered.top}px"
      onpointerdown={(event) => event.preventDefault()}
      onmousedown={(event) => event.preventDefault()}
      onclick={() => {
        // Read before `offer` goes, which `offered` follows.
        const { span } = offered
        offer = undefined
        show(span, HANDLES_PX)
      }}>Look up</button
    >
  {/if}
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
