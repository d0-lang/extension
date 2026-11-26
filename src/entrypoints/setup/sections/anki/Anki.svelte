<script lang="ts">
  import { onMount } from "svelte"
  import CircleAlertIcon from "@lucide/svelte/icons/circle-alert"
  import CircleCheckIcon from "@lucide/svelte/icons/circle-check"
  import LoaderIcon from "@lucide/svelte/icons/loader-circle"
  import { Button } from "$lib/components/ui/button"
  import { Input } from "$lib/components/ui/input"
  import { Label } from "$lib/components/ui/label"
  import { Switch } from "$lib/components/ui/switch"
  import { languageName } from "$lib/languages"
  import {
    ANKI_KEYS,
    deckFor,
    isSeedKey,
    getAnkiDecks,
    getAnkiEnabled,
    getSeeds,
    getLanguageOrder,
    getServerByLang,
    setAnkiDeck,
    setAnkiEnabled,
    type AnkiDecks,
    type SourceLanguage,
  } from "$lib/storage"
  import SectionTitle from "../../layout/SectionTitle.svelte"
  import { ankiErrorText } from "$lib/anki/connect"
  import { AnkiConnection } from "./connection.svelte"
  import DeckPicker from "./DeckPicker.svelte"
  import { sourceLanguages } from "./languages"

  const connection = new AnkiConnection()
  /** Unset until storage answers, so the switch does not flip after showing. */
  let enabled = $state<boolean>()
  /** The decks the user picked, by language. */
  let chosen = $state.raw<AnkiDecks>({})
  let languages = $state.raw<Array<SourceLanguage>>([])
  let keptCount = $state(0)
  let key = $state("")

  const decks = $derived(connection.status.kind === "connected" ? connection.status.decks : [])

  const load = async () => {
    const [on, picked, serverByLang, order, seeds] = await Promise.all([
      getAnkiEnabled(),
      getAnkiDecks(),
      getServerByLang(),
      getLanguageOrder(),
      getSeeds(),
    ])
    enabled = on
    keptCount = seeds.length
    chosen = picked
    languages = sourceLanguages(Object.keys(serverByLang), order)
  }

  onMount(() => {
    void load()
    void connection.check()
    // Another settings tab, or binding a server, changes what is listed.
    const keys = [...ANKI_KEYS, "serverByLang", "languageOrder"]
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area === "local" && Object.keys(changes).some((name) => keys.includes(name) || isSeedKey(name))) {
        void load()
      }
    }
    browser.storage.onChanged.addListener(onChanged)
    return () => browser.storage.onChanged.removeListener(onChanged)
  })

  const toggle = async (checked: boolean) => {
    enabled = checked
    await setAnkiEnabled(checked)
  }

  const submitKey = (event: SubmitEvent) => {
    event.preventDefault()
    void connection.connect(key)
  }
</script>

<section class="flex max-w-2xl flex-col gap-5">
  <SectionTitle title="Anki">
    {#if enabled && keptCount > 0}
      <Button href="/review.html" target="_blank" variant="outline" size="sm">
        Review {keptCount} kept {keptCount === 1 ? "word" : "words"}
      </Button>
    {/if}
  </SectionTitle>
  <div class={["flex flex-col divide-y rounded-lg border", enabled === undefined && "invisible"]}>
    <div class="flex items-center justify-between gap-4 p-4">
      <div class="flex flex-col gap-0.5">
        <Label for="anki-enabled">Add words to Anki</Label>
        <p class="text-muted-foreground text-sm">
          Keep a word with its sentence from the popover, then pick its meanings and send it to Anki as a
          card.
        </p>
      </div>
      <Switch
        id="anki-enabled"
        checked={enabled ?? false}
        onCheckedChange={(checked) => void toggle(checked)}
      />
    </div>
    <div class="flex flex-col gap-3 p-4">
      <div class="flex items-center gap-3" role="status">
        {#if connection.status.kind === "checking"}
          <LoaderIcon class="text-muted-foreground size-4 shrink-0 animate-spin" />
          <p class="text-muted-foreground flex-1 text-sm">Looking for Anki…</p>
        {:else if connection.status.kind === "connected"}
          <CircleCheckIcon class="text-muted-foreground size-4 shrink-0" />
          <p class="flex-1 text-sm">Connected to Anki</p>
        {:else}
          <CircleAlertIcon class="text-destructive size-4 shrink-0" />
          <p class="flex-1 text-sm">
            {connection.status.kind === "key"
              ? "AnkiConnect asks for its API key. Find it under Tools → Add-ons → AnkiConnect → Config."
              : ankiErrorText(connection.status.error)}
          </p>
        {/if}
        {#if connection.status.kind !== "key"}
          <Button
            variant="outline"
            size="sm"
            disabled={connection.busy || connection.status.kind === "checking"}
            onclick={() => void connection.connect()}
          >
            {connection.status.kind === "connected" ? "Check again" : "Connect"}
          </Button>
        {/if}
      </div>
      {#if connection.status.kind === "key"}
        <form class="flex gap-2" onsubmit={submitKey}>
          <Input bind:value={key} type="password" placeholder="API key" aria-label="AnkiConnect API key" />
          <Button type="submit" variant="outline" disabled={connection.busy}>Connect</Button>
        </form>
      {/if}
    </div>
  </div>

  {#if enabled}
    <div class="flex flex-col gap-2">
      <h2 class="text-muted-foreground text-sm font-medium">Languages</h2>
      {#if languages.length === 0}
        <p class="text-muted-foreground text-sm">Add a dictionary server to pick decks for its languages.</p>
      {:else}
        <ul class="flex flex-col divide-y rounded-lg border">
          {#each languages as language (language)}
            {@const name = languageName(language)}
            <li
              class="grid items-center gap-x-4 gap-y-2 px-4 py-3 @min-[32rem]:grid-cols-[8rem_minmax(0,1fr)]"
            >
              <span class="text-sm font-medium">{name}</span>
              <DeckPicker
                {decks}
                deck={deckFor(chosen, language)}
                label="Deck for {name}"
                pick={(deck) => void setAnkiDeck(language, deck)}
              />
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</section>
