<script lang="ts">
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right"
  import type { SourceLink } from "$lib/dict/sources"

  let { links }: { links: Array<SourceLink> } = $props()

  // Alt + click downloads a link in Chrome, and Alt is often still held from the lookup.
  const openWithAlt = (event: MouseEvent, href: string) => {
    if (event.altKey) {
      event.preventDefault()
      window.open(href, "_blank", "noopener,noreferrer")
    }
  }
</script>

<div class="flex flex-col gap-2">
  <h2 class="text-muted-foreground text-xs font-medium">Sources</h2>
  <ul class="flex flex-col gap-1.5">
    {#each links as link (link.href)}
      <li class="flex items-baseline gap-3">
        <span class="min-w-0 flex-1 wrap-anywhere"
          >{link.lemma}{#if link.kind === "recording"}<span class="text-muted-foreground">, recording</span
            >{/if}</span
        >
        <!-- No referrer, so the source's site does not learn which page the word was looked up on. -->
        <a
          class="shrink-0 text-xs underline underline-offset-2"
          href={link.href}
          title={link.href}
          target="_blank"
          rel="noreferrer"
          onclick={(event) => openWithAlt(event, link.href)}
          >{link.name}&#x2060;<ArrowUpRight
            class="ml-px inline size-2.5 align-text-top opacity-60"
            aria-hidden="true"
          /></a
        >
      </li>
    {/each}
  </ul>
</div>
