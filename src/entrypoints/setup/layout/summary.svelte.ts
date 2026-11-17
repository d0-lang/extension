import { getContextSites, getServerIssues, getServers } from "$lib/storage"

/** The sidebar's counts, kept current as servers and blocked sites change in this tab or another. */
export class Summary {
  servers = $state(0)
  issues = $state(0)
  blocked = $state(0)

  load = async () => {
    const [servers, issues, sites] = await Promise.all([getServers(), getServerIssues(), getContextSites()])
    this.servers = Object.keys(servers).length
    this.issues = Object.keys(issues).length
    this.blocked = Object.values(sites).filter((on) => on === false).length
  }

  watch = (): (() => void) => {
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area === "local" && ["servers", "serverIssues", "contextSites"].some((key) => key in changes)) {
        void this.load()
      }
    }
    browser.storage.onChanged.addListener(onChanged)
    return () => browser.storage.onChanged.removeListener(onChanged)
  }
}
