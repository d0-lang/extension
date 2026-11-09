<script lang="ts">
  import type { Split } from "./reply"

  let {
    split,
    tab,
    pick,
  }: {
    split: Split
    tab: number
    pick: (tab: number) => void
  } = $props()

  const tabClass = (active: boolean) => [
    "h-6 cursor-pointer rounded-md px-1 font-medium",
    active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
  ]
</script>

<!-- Outside the scroller, so it stays in view while the entries scroll. -->
<div class="flex shrink-0 flex-wrap items-center gap-x-0.5 gap-y-0.5 border-b px-3 py-1.5" role="tablist">
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
