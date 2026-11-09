<script lang="ts">
  import type { Snippet } from "svelte"
  import type { LookupEntry } from "$lib/dict/types"
  import type { Split } from "./reply"

  let {
    split,
    entryList,
    jump,
  }: {
    split: Split
    entryList: Snippet<[Array<LookupEntry>]>
    /** Scroll to the section of part `index`. */
    jump: (index: number) => void
  } = $props()
</script>

<p class="flex flex-wrap items-baseline gap-x-1 text-base">
  {#each split.parts as part, partIndex (partIndex)}
    {@const clicked = split.clicked.includes(partIndex)}
    {#if partIndex > 0}<span class="text-muted-foreground" aria-hidden="true">+</span>{/if}
    {#if part.entries.length === 0}
      <span class={["text-muted-foreground", clicked && "bg-muted rounded px-1"]}>{part.text}</span>
    {:else}
      <a
        href="#segment"
        class={["font-medium underline underline-offset-2", clicked && "bg-muted rounded px-1"]}
        title={clicked ? "The part you looked up" : undefined}
        onclick={(event) => {
          event.preventDefault()
          jump(partIndex)
        }}>{part.text}</a
      >
    {/if}
  {/each}
</p>
{@render entryList(split.whole)}
{#each split.parts as part, partIndex (partIndex)}
  {#if part.entries.length > 0}
    <div class="flex flex-col gap-2 border-t pt-2" data-segment={partIndex}>
      {@render entryList(part.entries)}
    </div>
  {/if}
{/each}
