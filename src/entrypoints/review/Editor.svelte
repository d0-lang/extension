<script lang="ts">
  import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert"
  import { Button } from "$lib/components/ui/button"
  import { Checkbox } from "$lib/components/ui/checkbox"
  import Keycap from "$lib/components/Keycap.svelte"
  import { posName } from "$lib/popover/labels"
  import Stressed from "$lib/popover/Stressed.svelte"
  import type { CardDraft, CardSeed } from "$lib/storage"
  import EditField from "./EditField.svelte"
  import { draftSentence, senseText } from "./fields"
  import type { Focus, Review } from "./review.svelte"

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

  /** Keeps the edit, then sends, as Ctrl + Enter does anywhere on the page. */
  const keepAndSend = (target: Focus, text: string) => {
    review.keepEdit(target, text)
    void review.send()
  }

  const focusClass = (target: Focus) =>
    review.focus === target && review.editing !== target ? "bg-accent" : "hover:bg-accent/50"
</script>

<div class="flex flex-col gap-4">
  <div class="flex flex-col gap-1">
    {#if review.editing === "sentence"}
      <EditField
        value={draftSentence(seed, draft)}
        label="Sentence"
        class="text-xl leading-snug"
        keep={(text) => review.keepEdit("sentence", text)}
        cancel={review.cancelEdit}
        send={(text) => keepAndSend("sentence", text)}
      />
      <p class="text-muted-foreground text-xs">
        Put ** around what is bold. <Keycap>Enter</Keycap> keeps it, <Keycap>Esc</Keycap> undoes it.
      </p>
    {:else if sentence === ""}
      <p class="px-2 text-xl leading-snug">{seed.word}</p>
    {:else}
      <button
        type="button"
        class={[
          "[&_b]:text-link cursor-text rounded-md px-2 py-1 text-left text-xl leading-snug [&_b]:font-semibold",
          focusClass("sentence"),
        ]}
        title="Edit the sentence (E)"
        onclick={() => review.edit("sentence")}
      >
        {@html sentence}
      </button>
    {/if}
    <p class="text-muted-foreground truncate px-2 text-xs">{seed.page.title || seed.page.url}</p>
  </div>

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
    <ol class="flex flex-col gap-0.5" aria-label="Meanings of {entry.lemma}">
      {#each entry.senses as _, index (index)}
        {@const id = `sense-${index}`}
        <li class={["flex items-start gap-3 rounded-md px-2 py-1.5", focusClass(index)]}>
          <span class="text-muted-foreground w-4 shrink-0 pt-px text-right text-sm tabular-nums">
            {index + 1}
          </span>
          <Checkbox
            {id}
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
              send={(text) => keepAndSend(index, text)}
            />
          {:else}
            <button
              type="button"
              class="flex-1 cursor-text text-left text-sm leading-snug"
              title="Edit this meaning (E)"
              onclick={() => review.edit(index)}
            >
              {senseText(seed, draft, index)}
            </button>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}

  <div class="flex flex-wrap items-center gap-2">
    <Button disabled={draft.senses.length === 0 || review.sending} onclick={() => void review.send()}>
      {review.sending ? "Sending…" : "Send to Anki"}
      <Keycap>Ctrl</Keycap><Keycap>Enter</Keycap>
    </Button>
    <Button variant={review.dropArmed ? "destructive" : "outline"} onclick={() => void review.drop()}>
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
