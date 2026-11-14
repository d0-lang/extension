<script lang="ts">
  import type { CreditSource } from "$lib/storage"
  import { pairName } from "../languages"

  let { sources }: { sources: Array<CreditSource> } = $props()

  /** Sources shown before folding the rest away. */
  const FOLDED_SOURCES = 3
  /** Folding away fewer than this many would save less than the button takes. */
  const MIN_FOLDED_AWAY = 2

  let unfolded = $state(false)
  const folds = $derived(sources.length - FOLDED_SOURCES >= MIN_FOLDED_AWAY)
  const shown = $derived(folds && !unfolded ? sources.slice(0, FOLDED_SOURCES) : sources)
</script>

<!-- The client writes the credit itself. Only the names and links come from the server. -->
<ul class="text-muted-foreground flex flex-col gap-1">
  {#each shown as source (source.url)}
    <li class="wrap-anywhere">
      Derived from <a class="text-foreground underline" href={source.url} target="_blank" rel="noreferrer"
        >{source.name}</a
      >{#if source.license !== undefined}, under {#if source.licenseUrl === undefined}{source.license}{:else}<a
            class="text-foreground underline"
            href={source.licenseUrl}
            target="_blank"
            rel="noreferrer">{source.license}</a
          >{/if}{/if}.{#if source.languages !== undefined}{" "}Used for {source.languages
          .map(pairName)
          .join(", ")}.{/if}
    </li>
  {/each}
  {#if folds}
    <li>
      <button
        type="button"
        class="hover:text-foreground cursor-pointer text-xs underline underline-offset-2"
        aria-expanded={unfolded}
        onclick={() => (unfolded = !unfolded)}
      >
        {unfolded ? "Show fewer sources" : `${sources.length - FOLDED_SOURCES} more sources`}
      </button>
    </li>
  {/if}
</ul>
