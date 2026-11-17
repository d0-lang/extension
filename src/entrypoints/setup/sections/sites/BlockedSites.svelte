<script lang="ts">
  import { onMount } from "svelte"
  import XIcon from "@lucide/svelte/icons/x"
  import { Button } from "$lib/components/ui/button"
  import { Input } from "$lib/components/ui/input"
  import { blockContextSite, getContextSites, removeContextSite } from "$lib/storage"
  import SectionTitle from "../../layout/SectionTitle.svelte"
  import { siteHost } from "./site-host"

  let blocked = $state<Array<string>>([])
  let draft = $state("")
  let draftError = $state<string>()

  const load = async () => {
    const sites = await getContextSites()
    blocked = Object.keys(sites)
      .filter((host) => sites[host] === false)
      .sort()
  }

  onMount(() => {
    void load()
    // Another settings tab can change the blocked sites.
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area === "local" && "contextSites" in changes) {
        void load()
      }
    }
    browser.storage.onChanged.addListener(onChanged)
    return () => browser.storage.onChanged.removeListener(onChanged)
  })

  /** Blocks every site in the draft. Entries that are not a site stay in the draft to fix. */
  const addBlocked = async (event: SubmitEvent) => {
    event.preventDefault()
    const entries = draft.split(/[,\s]+/).filter((entry) => entry !== "")
    const invalid = entries.filter((entry) => siteHost(entry) === undefined)
    draft = invalid.join(", ")
    draftError =
      invalid.length === 0 ? undefined : `Not a site: ${draft}. Enter sites like gmail.com, or links to them.`
    for (const entry of entries) {
      const host = siteHost(entry)
      if (host !== undefined) {
        // One at a time, since each write reads the list the last one left.
        await blockContextSite(host)
      }
    }
  }
</script>

<section class="flex max-w-2xl flex-col gap-5">
  <div class="flex flex-col gap-1">
    <SectionTitle title="Blocked sites" />
    <p class="text-muted-foreground text-sm">
      Only the looked up word is sent from these sites, unless a server is set to get sentences from all
      sites.
    </p>
  </div>
  <form class="flex gap-2" onsubmit={(event) => void addBlocked(event)}>
    <Input
      bind:value={draft}
      placeholder="mail.google.com, docs.google.com"
      aria-label="Sites to block, separated by commas"
      aria-invalid={draftError !== undefined}
      oninput={() => (draftError = undefined)}
    />
    <Button type="submit" variant="outline" disabled={draft.trim() === ""}>Block</Button>
  </form>
  {#if draftError !== undefined}
    <p class="text-destructive text-sm">{draftError}</p>
  {/if}
  {#if blocked.length === 0}
    <p class="text-muted-foreground text-sm">No blocked sites.</p>
  {:else}
    <ul class="flex flex-col divide-y rounded-lg border">
      {#each blocked as host (host)}
        <li class="flex items-center justify-between gap-4 py-1.5 pr-1.5 pl-4">
          <span class="min-w-0 truncate text-sm" title={host}>{host}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Unblock {host}"
            title="Unblock"
            onclick={() => void removeContextSite(host)}
          >
            <XIcon />
          </Button>
        </li>
      {/each}
    </ul>
  {/if}
</section>
