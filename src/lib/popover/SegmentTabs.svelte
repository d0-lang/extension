<script lang="ts">
  import Keycap from "$lib/components/Keycap.svelte"
  import { pickableParts, type Split } from "./reply"

  let {
    split,
    tab,
    pick,
  }: {
    split: Split
    tab: number
    pick: (tab: number) => void
  } = $props()

  /** A and D only step when there is another part to go to. */
  const stepping = $derived(pickableParts(split).length > 1)

  const tabClass = (active: boolean) => [
    "h-6 cursor-pointer rounded-md px-1 font-medium",
    active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
  ]
</script>

<!-- Outside the scroller, so it stays in view while the entries scroll. -->
<div class="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
  {#if stepping}
    <Keycap class="shrink-0" title="Previous part">A</Keycap>
  {/if}
  <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-0.5 gap-y-0.5" role="tablist">
    {#each split.parts as part, partIndex (partIndex)}
      {@const clicked = split.clicked.includes(partIndex)}
      {#if partIndex > 0}<span class="text-muted-foreground" aria-hidden="true">+</span>{/if}
      {#if part.entries.length === 0}
        <span class={["text-muted-foreground/70 px-0", clicked && "underline underline-offset-4"]}
          >{part.text}</span
        >
      {:else}
        <button
          type="button"
          role="tab"
          aria-selected={tab === partIndex}
          class={[tabClass(tab === partIndex), clicked && "underline decoration-2 underline-offset-4"]}
          title={clicked ? "The part you looked up" : undefined}
          onclick={() => pick(partIndex)}
        >
          {part.text}
        </button>
      {/if}
    {/each}
  </div>
  {#if stepping}
    <Keycap class="shrink-0" title="Next part">D</Keycap>
  {/if}
</div>
