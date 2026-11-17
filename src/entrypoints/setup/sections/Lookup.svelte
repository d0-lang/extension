<script lang="ts">
  import { onMount } from "svelte"
  import XIcon from "@lucide/svelte/icons/x"
  import { Button } from "$lib/components/ui/button"
  import { Input } from "$lib/components/ui/input"
  import Keycap from "$lib/components/Keycap.svelte"
  import { Label } from "$lib/components/ui/label"
  import { Switch } from "$lib/components/ui/switch"
  import {
    blockContextSite,
    getContextSites,
    getLookupEnabled,
    getPauseOnLookup,
    getYoutubeCaptions,
    removeContextSite,
    setLookupEnabled,
    setPauseOnLookup,
    setYoutubeCaptions,
  } from "$lib/storage"

  let lookupEnabled = $state(true)
  let youtubeCaptions = $state(true)
  let pauseOnLookup = $state(true)
  let blocked = $state<Array<string>>([])
  let draft = $state("")
  let draftError = $state<string>()

  const load = async () => {
    const [lookup, youtube, pause, sites] = await Promise.all([
      getLookupEnabled(),
      getYoutubeCaptions(),
      getPauseOnLookup(),
      getContextSites(),
    ])
    lookupEnabled = lookup
    youtubeCaptions = youtube
    pauseOnLookup = pause
    blocked = Object.keys(sites)
      .filter((host) => sites[host] === false)
      .sort()
  }

  onMount(() => {
    void load()
    // The popup can change lookup, and another settings tab the blocked sites.
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (
        area === "local" &&
        ["lookupEnabled", "youtubeCaptions", "pauseOnLookup", "contextSites"].some((key) => key in changes)
      ) {
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

  const onYoutubeCaptions = async (checked: boolean) => {
    youtubeCaptions = checked
    await setYoutubeCaptions(checked)
  }

  const onPauseOnLookup = async (checked: boolean) => {
    pauseOnLookup = checked
    await setPauseOnLookup(checked)
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
          Hold <Keycap>Alt</Keycap> over a word, or right-click and choose Look up.
        </p>
      </div>
      <Switch
        id="lookup-enabled"
        checked={lookupEnabled}
        onCheckedChange={(checked) => void onLookup(checked)}
      />
    </div>
    <div class="flex items-center justify-between gap-4 p-4">
      <div class="flex flex-col gap-0.5">
        <Label for="youtube-captions">Clickable YouTube subtitles</Label>
        <p class="text-muted-foreground text-sm">
          Shows YouTube's subtitles a sentence or two at a time. Click a word to look it up.
        </p>
      </div>
      <Switch
        id="youtube-captions"
        checked={youtubeCaptions}
        disabled={!lookupEnabled}
        onCheckedChange={(checked) => void onYoutubeCaptions(checked)}
      />
    </div>
    <div class="flex items-center justify-between gap-4 p-4">
      <div class="flex flex-col gap-0.5">
        <Label for="pause-on-lookup">Pause while looking up</Label>
        <p class="text-muted-foreground text-sm">
          Pauses the video while a word from its subtitles is open, and plays it again when it closes.
        </p>
      </div>
      <Switch
        id="pause-on-lookup"
        checked={pauseOnLookup}
        disabled={!lookupEnabled || !youtubeCaptions}
        onCheckedChange={(checked) => void onPauseOnLookup(checked)}
      />
    </div>
    <div class="flex flex-col gap-2 p-4">
      <div class="flex flex-col gap-0.5">
        <p class="text-sm font-medium">Blocked sites</p>
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
