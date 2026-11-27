<script lang="ts">
  import { Checkbox } from "$lib/components/ui/checkbox"
  import type { LookupEntry } from "$lib/dict/types"
  import type { CardDraft, CardSeed } from "$lib/storage"
  import EditField from "./EditField.svelte"
  import { senseText } from "./fields"
  import type { Review } from "./review.svelte"

  let {
    review,
    seed,
    draft,
    entry,
  }: { review: Review; seed: CardSeed; draft: CardDraft; entry: LookupEntry } = $props()
</script>

<ol class="flex flex-col gap-0.5" aria-label="Meanings of {entry.lemma}">
  {#each entry.senses as _, index (index)}
    <li
      class={[
        "flex items-start gap-3 rounded-md px-2 py-1.5",
        review.selected(index) ? "bg-accent" : "hover:bg-accent/50",
      ]}
    >
      <span class="text-muted-foreground w-4 shrink-0 pt-px text-right text-sm tabular-nums">
        {index + 1}
      </span>
      <Checkbox
        class="mt-0.5"
        aria-label="Pick meaning {index + 1}"
        checked={draft.senses.includes(index)}
        onCheckedChange={() => review.toggleSense(index)}
      />
      {#if review.editing === index}
        <EditField
          value={senseText(seed, draft, index)}
          label="Meaning {index + 1}"
          class="-my-1 text-sm leading-snug"
          keep={(text) => review.keepEdit(index, text)}
          cancel={review.cancelEdit}
          send={(text) => review.keepAndSend(index, text)}
        />
      {:else}
        <button
          type="button"
          class="flex-1 cursor-text text-start text-sm leading-snug"
          title="Edit this meaning (E)"
          dir="auto"
          onclick={() => review.edit(index)}
        >
          {senseText(seed, draft, index)}
        </button>
      {/if}
    </li>
  {/each}
</ol>
