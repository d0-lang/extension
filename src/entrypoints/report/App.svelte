<script lang="ts">
  import { onMount } from "svelte"
  import CircleHelpIcon from "@lucide/svelte/icons/circle-help"
  import FlagIcon from "@lucide/svelte/icons/flag"
  import Keycap from "$lib/components/Keycap.svelte"
  import PageHeader from "$lib/components/PageHeader.svelte"
  import { parseReportTab } from "$lib/report-page"
  import { getLastLookup, getServers } from "$lib/storage"
  import { describeBrowser } from "./browser-name"
  import { buildName, pageIssueLink, wordReport, type WordReport } from "./links"

  const version = browser.runtime.getManifest().version
  // The page form takes the commit too; the word report's `client` stays as the protocol spells it.
  const build = buildName(version, import.meta.env.BUILD_COMMIT)
  const tabId = parseReportTab(location.search)

  let loaded = $state(false)
  let report = $state<WordReport | undefined>()
  let issueHref = $state(pageIssueLink(undefined, build))

  const loadReport = async () => {
    const [lookup, servers] = await Promise.all([getLastLookup(tabId), getServers()])
    report = wordReport(lookup, servers, version)
  }

  onMount(() => {
    void loadReport().finally(() => {
      loaded = true
    })
    void describeBrowser().then((browserName) => {
      issueHref = pageIssueLink(browserName, build)
    })
  })

  const option =
    "hover:bg-accent focus-visible:ring-ring flex items-start gap-3 rounded-lg border p-4 outline-hidden focus-visible:ring-2 [&_svg]:mt-0.5 [&_svg]:size-5 [&_svg]:shrink-0"
</script>

<div class="bg-background min-h-svh">
  <PageHeader class="max-w-xl" />

  <main class="mx-auto flex max-w-xl flex-col gap-4 px-6 py-8">
    <h1 class="text-xl font-medium">Report a problem</h1>
    {#if loaded}
      {#if report !== undefined}
        {@const { href, word, host } = report}
        <a {href} class={option}>
          <FlagIcon />
          <span class="flex min-w-0 flex-col gap-1">
            <span class="text-base font-medium">The popover showed a wrong or missing meaning</span>
            <span class="text-muted-foreground text-sm break-words">Report “{word}” on {host}</span>
          </span>
        </a>
      {/if}
      <a href={issueHref} class={option}>
        <CircleHelpIcon />
        <span class="flex flex-col gap-1">
          <span class="text-base font-medium">Something {report === undefined ? "" : "else "}went wrong</span>
          <span class="text-muted-foreground text-sm"
            >Opens DaDict's report form, no GitHub account needed</span
          >
        </span>
      </a>
      <p class="text-muted-foreground text-sm">
        Press <Keycap>B</Keycap> in the popover to come here with the word it shows.
      </p>
    {/if}
  </main>
</div>
