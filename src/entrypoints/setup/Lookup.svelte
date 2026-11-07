<script lang="ts">
  import { onMount } from "svelte"
  import XIcon from "@lucide/svelte/icons/x"
  import { Button } from "$lib/components/ui/button"
  import { Input } from "$lib/components/ui/input"
  import { Kbd } from "$lib/components/ui/kbd"
  import { Label } from "$lib/components/ui/label"
  import { Switch } from "$lib/components/ui/switch"
  import {
    blockContextSite,
    getContextSites,
    getLookupEnabled,
    removeContextSite,
    setLookupEnabled,
  } from "$lib/storage"

  let lookupEnabled = $state(true)
  let blocked = $state<Array<string>>([])
  let draft = $state("")
  let draftError = $state<string>()

  const load = async () => {
    const [lookup, sites] = await Promise.all([getLookupEnabled(), getContextSites()])
    lookupEnabled = lookup
    blocked = Object.keys(sites)
      .filter((host) => sites[host] === false)
      .sort()
  }

  onMount(() => {
    void load()
    // The popup can change lookup, and another settings tab the blocked sites.
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area === "local" && ["lookupEnabled", "contextSites"].some((key) => key in changes)) {
        void load()
      }
    }
    browser.storage.onChanged.addListener(onChanged)
    return () => browser.storage.onChanged.removeListener(onChanged)
  })

  const onLookup = async (checked: boolean) => {
    lookupEnabled = checked
    await setLookupEnabled(checked)
  }

  /** The host of a typed site or pasted URL. A leading `www.` is dropped, so the block covers the whole site. */
  const siteHost = (input: string): string | undefined => {
    const text = input.trim().toLowerCase()
    const host = URL.parse(text.includes("://") ? text : `https://${text}`)?.hostname
    // A bare word like `gmail` would match no site.
    return host === undefined || (!host.includes(".") && host !== "localhost")
      ? undefined
      : host.replace(/^www\./, "")
  }

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

<section class="flex flex-col gap-4">
  <h2 class="text-lg font-semibold">Lookup</h2>
  <div class="flex flex-col divide-y rounded-lg border">
    <div class="flex items-center justify-between gap-4 p-4">
      <div class="flex flex-col gap-0.5">
        <Label for="lookup-enabled">Word lookup</Label>
        <p class="text-muted-foreground text-sm">
          Hold <Kbd>Alt</Kbd> over a word, or right-click and choose Look up.
        </p>
      </div>
      <Switch
        id="lookup-enabled"
        checked={lookupEnabled}
        onCheckedChange={(checked) => void onLookup(checked)}
      />
    </div>
    <div class="flex flex-col gap-2 p-4">
      <div class="flex flex-col gap-0.5">
        <p class="text-sm font-medium">Blocked sites</p>
        <p class="text-muted-foreground text-sm">
          Servers set to take sentences from all sites except blocked ones only get the word for these
          websites.
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
        <ul class="flex flex-col divide-y rounded-md border">
          {#each blocked as host (host)}
            <li class="flex items-center justify-between gap-4 py-1 pr-1 pl-3">
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
    </div>
  </div>
</section>
