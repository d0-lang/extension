<script lang="ts">
  import { onMount } from "svelte"
  import BugIcon from "@lucide/svelte/icons/bug"
  import FlagIcon from "@lucide/svelte/icons/flag"
  import { getLastLookup, getServers } from "$lib/storage"
  import { describeBrowser } from "./browser-name"
  import { pageIssueLink, wordReport, type WordReport } from "./links"

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

  const line =
    "hover:bg-accent text-muted-foreground hover:text-foreground flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-left text-sm"
</script>

<div class="-mx-2 -mt-2 flex flex-col">
  {#if report !== undefined}
    {@const { href, word, host } = report}
    <button type="button" class={line} onclick={() => open(href)}>
      <FlagIcon class="mt-0.5 size-4 shrink-0" />
      <span class="flex min-w-0 flex-col">
        The popover showed a wrong or missing meaning
        <span class="text-xs break-words">Report “{word}” on {host}</span>
      </span>
    </button>
  {/if}
  <button type="button" class={line} onclick={() => open(issueHref)}>
    <BugIcon class="mt-0.5 size-4 shrink-0" />
    Something else went wrong
  </button>
</div>
