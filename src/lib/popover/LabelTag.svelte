<script lang="ts">
  import type { LabelExplanation } from "$lib/storage"

  let { label, explanation }: { label: string; explanation: LabelExplanation | undefined } = $props()

  /** Space kept between the tooltip and the popover's sides or the viewport's edge, and between it and the tag. */
  const MARGIN_PX = 8
  const GAP_PX = 4

  const tipId = $props.id()
  let tag = $state<HTMLButtonElement>()
  let tip = $state<HTMLElement>()
  /** Set by a move over the tag, not on entering it, since the popover can open with the tag under a still cursor. */
  let hovered = $state(false)
  let focused = $state(false)
  let place = $state<{ top: number; left: number }>()
  const open = $derived(hovered || focused)

  // Fixed, so the scroller does not clip it. It sits below the tag, or above it near the bottom of the viewport,
  // and stays within the popover's sides.
  $effect(() => {
    if (!open || tag === undefined || tip === undefined) {
      place = undefined
      return
    }
    const anchor = tag.getBoundingClientRect()
    // Unplaced, it sits at the corner it is fixed to. That is the viewport's, unless an ancestor is transformed.
    const { width, height, top: originTop, left: originLeft } = tip.getBoundingClientRect()
    const bounds = tag.closest(".dict-popover")?.getBoundingClientRect() ?? {
      left: 0,
      right: window.innerWidth,
    }
    const below = anchor.bottom + GAP_PX
    place = {
      top:
        (below + height + MARGIN_PX > window.innerHeight
          ? Math.max(MARGIN_PX, anchor.top - GAP_PX - height)
          : below) - originTop,
      left:
        Math.max(bounds.left + MARGIN_PX, Math.min(anchor.left, bounds.right - width - MARGIN_PX)) -
        originLeft,
    }
    // A scroll moves the tag away from where the tooltip was placed.
    const close = () => {
      hovered = false
      tag?.blur()
    }
    window.addEventListener("scroll", close, { capture: true, passive: true })
    return () => window.removeEventListener("scroll", close, { capture: true })
  })
</script>

{#if explanation === undefined}
  <span class="bg-muted text-muted-foreground rounded px-1 text-xs whitespace-nowrap" data-label>{label}</span
  >
{:else}
  <button
    bind:this={tag}
    type="button"
    aria-describedby={tipId}
    class="bg-muted align-baseline leading-[normal] text-muted-foreground hover:text-foreground focus-visible:text-foreground cursor-help rounded px-1 text-xs whitespace-nowrap underline decoration-dotted underline-offset-2"
    data-label
    onpointermove={() => (hovered = true)}
    onpointerleave={() => (hovered = false)}
    onfocus={() => (focused = true)}
    onblur={() => (focused = false)}>{label}</button
  ><!-- Always in the document, so a screen reader can read it as the tag's description. --><span
    bind:this={tip}
    id={tipId}
    role="tooltip"
    class={[
      "bg-popover text-popover-foreground pointer-events-none fixed z-10 flex w-max max-w-64 flex-col gap-0.5 rounded-md border px-2 py-1.5 text-xs whitespace-normal shadow-md",
      (!open || place === undefined) && "invisible",
    ]}
    style:top="{place?.top ?? 0}px"
    style:left="{place?.left ?? 0}px"
    ><span class="font-medium wrap-anywhere">{explanation.name}</span
    >{#if explanation.text !== undefined}<span class="text-muted-foreground whitespace-pre-line wrap-anywhere"
        >{explanation.text}</span
      >{/if}</span
  >
{/if}
