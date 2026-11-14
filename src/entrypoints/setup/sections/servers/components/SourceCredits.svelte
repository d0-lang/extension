<script lang="ts">
  import type { CreditSource } from "$lib/storage"
  import { pairName } from "../languages"

  let { sources }: { sources: Array<CreditSource> } = $props()
</script>

<!-- The client writes the credit itself. Only the names and links come from the server. -->
<ul class="text-muted-foreground flex flex-col gap-1">
  {#each sources as source (source.url)}
    <li class="wrap-anywhere">
      Derived from <a class="text-foreground underline" href={source.url} target="_blank" rel="noreferrer"
        >{source.name}</a
      >{#if source.license !== undefined}, under {#if source.licenseUrl === undefined}{source.license}{:else}<a
            class="text-foreground underline"
            href={source.licenseUrl}
            target="_blank"
            rel="noreferrer">{source.license}</a
          >{/if}{/if}.{#if source.languages !== undefined}
        Used for {source.languages.map(pairName).join(", ")}.{/if}
    </li>
  {/each}
</ul>
