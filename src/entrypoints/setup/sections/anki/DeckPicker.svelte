<script lang="ts">
  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down"
  import PlusIcon from "@lucide/svelte/icons/plus"
  import { Button } from "$lib/components/ui/button"
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "$lib/components/ui/dropdown-menu"
  import { Input } from "$lib/components/ui/input"

  let {
    decks,
    deck,
    label,
    pick,
  }: {
    /** Anki's decks. */
    decks: Array<string>
    /** The deck the cards go to, which Anki may not have yet. */
    deck: string
    /** What the picker is for, for screen readers. */
    label: string
    pick: (deck: string) => void
  } = $props()

  /** Set while the user types a new deck's name. */
  let draft = $state<string>()

  const options = $derived(decks.includes(deck) ? decks : [deck, ...decks])

  const addDeck = (event: SubmitEvent) => {
    event.preventDefault()
    const name = draft?.trim() ?? ""
    draft = undefined
    if (name !== "") {
      pick(name)
    }
  }
</script>

{#if draft === undefined}
  <DropdownMenu>
    <DropdownMenuTrigger>
      {#snippet child({ props })}
        <Button {...props} variant="outline" class="w-full min-w-0 justify-between" aria-label={label}>
          <span class="truncate">{deck}</span>
          {#if !decks.includes(deck)}
            <span class="text-muted-foreground ml-auto text-xs">new</span>
          {/if}
          <ChevronsUpDownIcon class="text-muted-foreground" />
        </Button>
      {/snippet}
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="max-h-80 min-w-56">
      <DropdownMenuRadioGroup value={deck} onValueChange={pick}>
        {#each options as option (option)}
          <DropdownMenuRadioItem value={option} closeOnSelect>{option}</DropdownMenuRadioItem>
        {/each}
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => (draft = "")}>
        <PlusIcon />
        New deck…
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
{:else}
  <!-- Anki makes the deck when the first card goes to it, so nothing is created here. -->
  <form class="flex w-full gap-2" onsubmit={addDeck}>
    <!-- svelte-ignore a11y_autofocus -->
    <Input
      bind:value={draft}
      autofocus
      placeholder="Deck name, :: for a subdeck"
      aria-label="New deck for {label}"
      onkeydown={(event) => {
        if (event.key === "Escape") {
          draft = undefined
        }
      }}
    />
    <Button type="submit" variant="outline">Add</Button>
  </form>
{/if}
