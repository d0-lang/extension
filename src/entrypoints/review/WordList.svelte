<script lang="ts">
  import Stressed from "$lib/popover/Stressed.svelte"
  import { cn } from "$lib/utils"
  import type { CardSeed } from "$lib/storage"

  let {
    seeds,
    current,
    show,
    class: className,
  }: {
    seeds: Array<CardSeed>
    current: string | undefined
    show: (id: string) => void
    class?: string
  } = $props()
</script>

<ul class={cn("flex flex-col gap-0.5", className)} aria-label="Kept words">
  {#each seeds as seed (seed.id)}
    {@const lemma = seed.entries[seed.entry]?.lemma ?? seed.word}
    <li>
      <button
        type="button"
        class={[
          "flex w-full cursor-pointer flex-col rounded-md px-3 py-2 text-left",
          seed.id === current ? "bg-accent" : "hover:bg-accent/60",
        ]}
        aria-current={seed.id === current}
        onclick={() => show(seed.id)}
      >
        <span class="flex items-baseline justify-between gap-2">
          <span class="truncate text-sm font-medium"><Stressed text={lemma} /></span>
          <span class="text-muted-foreground shrink-0 text-xs">{seed.lang.split("_", 1)[0]}</span>
        </span>
        <span class="text-muted-foreground truncate text-xs">{seed.sentence?.text ?? seed.page.title}</span>
      </button>
    </li>
  {/each}
</ul>
