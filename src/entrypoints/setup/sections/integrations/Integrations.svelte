<script lang="ts">
  import { onMount } from "svelte"
  import SearchIcon from "@lucide/svelte/icons/search"
  import { Input } from "$lib/components/ui/input"
  import { Switch } from "$lib/components/ui/switch"
  import { getLookupEnabled } from "$lib/storage"
  import SectionTitle from "../../layout/SectionTitle.svelte"
  import { groupIntegrations, integrations, SEARCH_FROM } from "./integrations"

  /** Integration name → whether it is on. Unset until storage answers, so no switch flips after showing. */
  let on = $state<Record<string, boolean>>()
  let lookupEnabled = $state(true)
  let query = $state("")

  const groups = $derived(groupIntegrations(integrations, query))

  const load = async () => {
    const [states, lookup] = await Promise.all([
      Promise.all(
        integrations.map(async (integration) => [integration.name, await integration.get()] as const),
      ),
      getLookupEnabled(),
    ])
    on = Object.fromEntries(states)
    lookupEnabled = lookup
  }

  onMount(() => {
    void load()
    // The header and the popup turn lookup off, which every integration needs.
    const keys = ["lookupEnabled", ...integrations.map((integration) => integration.key)]
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area === "local" && keys.some((key) => key in changes)) {
        void load()
      }
    }
    browser.storage.onChanged.addListener(onChanged)
    return () => browser.storage.onChanged.removeListener(onChanged)
  })

  const toggle = async (name: string, set: (on: boolean) => Promise<void>, checked: boolean) => {
    on = { ...on, [name]: checked }
    await set(checked)
  }
</script>

<section class="flex max-w-2xl flex-col gap-5">
  <SectionTitle title="Integrations" />
  {#if integrations.length >= SEARCH_FROM}
    <div class="relative">
      <SearchIcon
        class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
      />
      <Input
        bind:value={query}
        type="search"
        class="pl-9"
        placeholder="Search {integrations.length} integrations"
        aria-label="Search integrations"
      />
    </div>
  {/if}
  {#each on === undefined ? [] : groups as { kind, items } (kind)}
    <div class="flex flex-col gap-2">
      <h2 class="text-muted-foreground text-sm font-medium">{kind}</h2>
      <ul class="flex flex-col divide-y rounded-lg border">
        {#each items as integration (integration.name)}
          {@const id = `integration-${integration.name}`}
          <li class="flex items-center gap-3 px-4 py-3">
            <span
              class="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
              aria-hidden="true"
            >
              {integration.name[0]}
            </span>
            <label for={id} class="flex min-w-0 flex-1 flex-col">
              <span class="text-sm font-medium">{integration.name}</span>
              <span class="text-muted-foreground truncate text-sm">{integration.description}</span>
            </label>
            <Switch
              {id}
              checked={on?.[integration.name] ?? false}
              disabled={!lookupEnabled}
              onCheckedChange={(checked) => void toggle(integration.name, integration.set, checked)}
            />
          </li>
        {/each}
      </ul>
    </div>
  {:else}
    {#if on !== undefined}
      <p class="text-muted-foreground text-sm">No integration matches “{query.trim()}”.</p>
    {/if}
  {/each}
</section>
