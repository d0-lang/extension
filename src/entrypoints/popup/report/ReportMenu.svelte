<script lang="ts">
  import { onMount } from "svelte"
  import CircleHelpIcon from "@lucide/svelte/icons/circle-help"
  import FlagIcon from "@lucide/svelte/icons/flag"
  import { getLastLookup, getServers } from "$lib/storage"
  import { describeBrowser } from "./browser-name"
  import { pageIssueLink, wordReport, type WordReport } from "./links"

  let { id, shown }: { id: string; shown: boolean } = $props()

  const version = browser.runtime.getManifest().version

  let report = $state<WordReport | undefined>()
  let issueHref = $state(pageIssueLink(undefined, version))

  const loadReport = async () => {
    const [[tab], servers] = await Promise.all([
      browser.tabs.query({ active: true, currentWindow: true }),
      getServers(),
    ])
    const lookup = tab?.id === undefined ? undefined : await getLastLookup(tab.id)
    report = wordReport(lookup, servers, version)
  }

  onMount(() => {
    void loadReport()
    void describeBrowser().then((browserName) => {
      issueHref = pageIssueLink(browserName, version)
    })
  })

  const open = (url: string) => {
    void browser.tabs.create({ url })
    window.close()
  }

  const item =
    "hover:bg-accent focus-visible:bg-accent flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-hidden [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0"
</script>

<!-- In the flow, not floating: the popup window only grows for content that takes up space.
     Mounted while closed, so the links are ready when it opens. -->
<div
  {id}
  class={[
    "bg-popover text-popover-foreground ring-foreground/10 flex-col rounded-lg p-1 shadow-md ring-1",
    shown ? "flex" : "hidden",
  ]}
>
  <p class="text-muted-foreground px-2 py-1 text-xs font-medium">Report a problem</p>
  {#if report !== undefined}
    {@const { href, word, host } = report}
    <button type="button" class={item} onclick={() => open(href)}>
      <FlagIcon />
      <span class="flex min-w-0 flex-col">
        Wrong or missing meaning
        <span class="text-muted-foreground text-xs break-words">“{word}”, on {host}</span>
      </span>
    </button>
  {/if}
  <button type="button" class={item} onclick={() => open(issueHref)}>
    <CircleHelpIcon />
    <span class="flex flex-col">
      Something else
      <span class="text-muted-foreground text-xs">On github.com</span>
    </span>
  </button>
</div>
