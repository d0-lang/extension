<script lang="ts">
  import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert"
  import { Button } from "$lib/components/ui/button"
  import Keycap from "$lib/components/Keycap.svelte"
  import { posName } from "$lib/popover/labels"
  import Stressed from "$lib/popover/Stressed.svelte"
  import type { CardDraft, CardSeed } from "$lib/storage"
  import Meanings from "./Meanings.svelte"
  import type { Focus, Review } from "./review.svelte"
  import Sentence from "./Sentence.svelte"

  let {
    review,
    seed,
    draft,
    sentence,
  }: {
    review: Review
    seed: CardSeed
    draft: CardDraft
    /** The card's sentence as HTML, which `fields.ts` escaped. Empty for a word reached through a link. */
    sentence: string
  } = $props()

  const entry = $derived(seed.entries[draft.entry])

  /** The ring a selected button gets, as the keys move onto it. */
  const buttonRing = (target: Focus) => (review.focus === target ? "ring-ring/60 ring-3" : undefined)
</script>

<div class="flex flex-col gap-4">
  <Sentence {review} {seed} {draft} html={sentence} />

  {#if seed.entries.length > 1}
    <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Entry">
      {#each seed.entries as option, index (index)}
        <button
          type="button"
          role="radio"
          aria-checked={index === draft.entry}
          class={[
            "cursor-pointer rounded-md border px-2.5 py-1 text-sm",
            index === draft.entry ? "border-link bg-link/10" : "hover:bg-accent",
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
    <Meanings {review} {seed} {draft} {entry} />
  {/if}

  <div class="flex flex-wrap items-center gap-2">
    <Button
      class={buttonRing("send")}
      disabled={draft.senses.length === 0 || review.sending}
      onclick={() => {
        review.focus = "send"
        void review.send()
      }}
    >
      {review.sending ? "Sending…" : "Send to Anki"}
      <Keycap>Ctrl</Keycap><Keycap>Enter</Keycap>
    </Button>
    <Button
      class={buttonRing("drop")}
      variant={review.dropArmed ? "destructive" : "outline"}
      onclick={() => {
        review.focus = "drop"
        void review.drop()
      }}
    >
      {review.dropArmed ? "Drop it for good?" : "Drop"}
      <Keycap>X</Keycap>
    </Button>
    {#if review.dropArmed}
      <p class="text-muted-foreground text-sm">
        Press <Keycap>X</Keycap> again, or <Keycap>Esc</Keycap> to keep it.
      </p>
    {:else if draft.senses.length === 0}
      <p class="text-muted-foreground text-sm">Pick at least one meaning.</p>
    {/if}
  </div>
  {#if review.error !== undefined}
    <p class="text-destructive text-sm" role="alert">{review.error}</p>
  {/if}
</div>
