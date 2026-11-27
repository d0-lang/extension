<script lang="ts">
  import { onMount } from "svelte"
  import Deck from "$lib/components/Deck.svelte"
  import { playDeck } from "$lib/components/deck"
  import Keycap from "$lib/components/Keycap.svelte"

  let icon = $state<HTMLElement>()

  // Once on arrival and again on hover, so the icon shows what Q does.
  onMount(() => {
    const timer = setTimeout(() => playDeck(icon, "keep"), 300)
    return () => clearTimeout(timer)
  })
</script>

<div class="mx-auto flex max-w-md flex-col items-center gap-2 py-16 text-center">
  <span bind:this={icon} class="mb-2" role="presentation" onmouseenter={() => playDeck(icon, "keep")}>
    <Deck class="text-muted-foreground size-16" />
  </span>
  <h1 class="text-xl font-semibold">No kept words</h1>
  <p class="text-muted-foreground text-sm">
    Press <Keycap>Q</Keycap> in the popover, or its card button, to keep a word with its sentence. It waits here
    until you pick its meanings and send it to Anki.
  </p>
</div>
