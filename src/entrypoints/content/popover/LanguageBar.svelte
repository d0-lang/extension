<script lang="ts">
  import { Kbd } from "$lib/components/ui/kbd"

  let {
    languages,
    shown,
    pick,
  }: {
    languages: Array<string>
    shown: string | undefined
    pick: (code: string) => void
  } = $props()
</script>

<div class="mt-auto flex shrink-0 items-center gap-2 border-t p-2">
  <Kbd class="shrink-0" title="Previous language">A</Kbd>
  <div class="flex flex-1 flex-wrap justify-center gap-1" role="group" aria-label="Languages">
    {#each languages as code (code)}
      {@const active = shown === code}
      <button
        type="button"
        class={[
          "h-6 cursor-pointer rounded-md px-2 text-xs font-medium",
          active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
        ]}
        aria-pressed={active}
        title="Use {code} on this page"
        onclick={() => pick(code)}
      >
        {code}
      </button>
    {/each}
  </div>
  <Kbd class="shrink-0" title="Next language">D</Kbd>
</div>
