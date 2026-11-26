<script lang="ts">
  import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert"
  import { Button } from "$lib/components/ui/button"
  import { Checkbox } from "$lib/components/ui/checkbox"
  import Keycap from "$lib/components/Keycap.svelte"
  import { posName } from "$lib/popover/labels"
  import Stressed from "$lib/popover/Stressed.svelte"
  import type { CardSeed } from "$lib/storage"
  import type { Choice } from "./fields"
  import type { Review } from "./review.svelte"

  let {
    review,
    seed,
    choice,
    sentence,
  }: {
    review: Review
    seed: CardSeed
    choice: Choice
    /** The card's sentence as HTML, which `fields.ts` escaped. Empty for a word reached through a link. */
    sentence: string
  } = $props()

  const entry = $derived(seed.entries[choice.entry])
</script>

<div class="flex flex-col gap-4">
  <div class="flex flex-col gap-1">
    <p class="text-xl leading-snug [&_b]:text-link [&_b]:font-semibold">
      {#if sentence === ""}
        {seed.word}
      {:else}
        {@html sentence}
      {/if}
    </p>
    <p class="text-muted-foreground truncate text-xs">{seed.page.title || seed.page.url}</p>
  </div>

  {#if seed.entries.length > 1}
    <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Entry">
      {#each seed.entries as option, index (index)}
        <button
          type="button"
          role="radio"
          aria-checked={index === choice.entry}
          class={[
            "cursor-pointer rounded-md border px-2.5 py-1 text-sm",
            index === choice.entry ? "border-link bg-link/10" : "hover:bg-accent",
          ]}
          onclick={() => review.pickEntry(index)}
        >
          <span class="font-medium"><Stressed text={option.lemma} /></span>
          <span class="text-muted-foreground text-xs">{posName(option.pos)}</span>
        </button>
      {/each}
    </div>
  {/if}

  {#if entry !== undefined && review.inAnki[entry.lemma] === true}
    <p
      class="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md px-3 py-2 text-sm"
      role="status"
    >
      <TriangleAlertIcon class="size-4 shrink-0" />
      <span>Anki already has a card for <Stressed text={entry.lemma} />.</span>
    </p>
  {/if}

  {#if entry !== undefined}
    <ol class="flex flex-col gap-0.5" aria-label="Meanings of {entry.lemma}">
      {#each entry.senses as sense, index (index)}
        {@const id = `sense-${index}`}
        <li
          class={[
            "flex items-start gap-3 rounded-md px-2 py-1.5",
            index === review.focus ? "bg-accent" : "hover:bg-accent/50",
          ]}
        >
          <span class="text-muted-foreground w-4 shrink-0 pt-px text-right text-sm tabular-nums">
            {index + 1}
          </span>
          <Checkbox
            {id}
            class="mt-0.5"
            checked={choice.senses.includes(index)}
            onCheckedChange={() => review.toggleSense(index)}
          />
          <label for={id} class="flex-1 cursor-pointer text-sm leading-snug">{sense.glosses.join("; ")}</label
          >
        </li>
      {/each}
    </ol>
  {/if}

  <div class="flex flex-wrap items-center gap-2">
    <Button disabled={choice.senses.length === 0 || review.sending} onclick={() => void review.send()}>
      {review.sending ? "Sending…" : "Send to Anki"}
      <Keycap>Enter</Keycap>
    </Button>
    <Button variant="outline" onclick={() => void review.drop()}>
      Drop
      <Keycap>X</Keycap>
    </Button>
    {#if choice.senses.length === 0}
      <p class="text-muted-foreground text-sm">Pick at least one meaning.</p>
    {/if}
  </div>
  {#if review.error !== undefined}
    <p class="text-destructive text-sm" role="alert">{review.error}</p>
  {/if}
</div>
