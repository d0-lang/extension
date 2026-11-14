<script lang="ts">
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right"
  import ChevronDown from "@lucide/svelte/icons/chevron-down"
  import type { SourceLink } from "$lib/dict/sources"

  let { links }: { links: Array<SourceLink> } = $props()

  let open = $state(false)
  const listId = $props.id()

  // The list opens at the bottom of the scroller, which a long answer has pushed out of view.
  const reveal = (list: HTMLElement) => {
    list.scrollIntoView({ block: "nearest" })
  }
</script>

<div class="flex flex-col gap-1 border-t pt-1.5">
  <button
    type="button"
    class="text-muted-foreground hover:bg-accent hover:text-foreground inline-flex h-6 cursor-pointer items-center gap-1 self-start rounded-md px-1 text-xs font-medium"
    aria-expanded={open}
    aria-controls={listId}
    onclick={() => (open = !open)}
  >
    Sources
    <ChevronDown class={["size-3 transition-transform", open && "rotate-180"]} aria-hidden="true" />
  </button>
  {#if open}
    <ul id={listId} {@attach reveal} class="flex flex-col gap-1 px-1 pb-1 text-xs">
      {#each links as link (link.href)}
        <li class="flex items-baseline gap-2">
          <span class="text-muted-foreground min-w-0 flex-1 wrap-anywhere"
            >{link.lemma}{link.kind === "recording" ? ", recording" : ""}</span
          >
          <!-- No referrer, so the source's site does not learn which page the word was looked up on. -->
          <a
            class="shrink-0 underline underline-offset-2"
            href={link.href}
            title={link.href}
            target="_blank"
            rel="noreferrer"
            >{link.name}&#x2060;<ArrowUpRight
              class="ml-px inline size-2.5 align-text-top opacity-60"
              aria-hidden="true"
            /></a
          >
        </li>
      {/each}
    </ul>
  {/if}
</div>
