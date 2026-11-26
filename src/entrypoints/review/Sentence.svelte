<script lang="ts">
  import Keycap from "$lib/components/Keycap.svelte"
  import type { CardDraft, CardSeed } from "$lib/storage"
  import EditField from "./EditField.svelte"
  import { draftSentence } from "./fields"
  import type { Review } from "./review.svelte"

  let {
    review,
    seed,
    draft,
    html,
  }: {
    review: Review
    seed: CardSeed
    draft: CardDraft
    /** The card's sentence as HTML, which `fields.ts` escaped. Empty for a word reached through a link. */
    html: string
  } = $props()
</script>

<div class="flex flex-col gap-1">
  {#if review.editing === "sentence"}
    <EditField
      value={draftSentence(seed, draft)}
      label="Sentence"
      class="text-xl leading-snug"
      keep={(text) => review.keepEdit("sentence", text)}
      cancel={review.cancelEdit}
      send={(text) => review.keepAndSend("sentence", text)}
    />
    <p class="text-muted-foreground text-xs">
      Put ** around what is bold. <Keycap>Enter</Keycap> keeps it, <Keycap>Esc</Keycap> undoes it.
    </p>
  {:else if seed.sentence === undefined}
    <p class="px-2 text-xl leading-snug">{seed.word}</p>
  {:else}
    <button
      type="button"
      class={[
        "[&_b]:text-link cursor-text rounded-md px-2 py-1 text-left text-xl leading-snug [&_b]:font-semibold",
        review.selected("sentence") ? "bg-accent" : "hover:bg-accent/50",
      ]}
      title="Edit the sentence (E)"
      onclick={() => review.edit("sentence")}
    >
      {#if html === ""}
        <span class="text-muted-foreground">No sentence. Press E to write one.</span>
      {:else}
        {@html html}
      {/if}
    </button>
  {/if}
  <p class="text-muted-foreground truncate px-2 text-xs">{seed.page.title || seed.page.url}</p>
</div>
