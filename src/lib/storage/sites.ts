/** Sites blocked from sending the sentence around a word. */

/** Host → `false` where lookups do not send the sentence around the word. A host also covers its subdomains. Any `true` is left from older builds and ignored. */
export type ContextSites = Record<string, boolean>

const empty = {
  contextSites: {} as ContextSites,
}

export const getContextSites = async (): Promise<ContextSites> => {
  const { contextSites } = await browser.storage.local.get("contextSites")
  return contextSites !== undefined && typeof contextSites === "object" && !Array.isArray(contextSites)
    ? (contextSites as ContextSites)
    : empty.contextSites
}

const covers = (blocked: string, host: string): boolean => host === blocked || host.endsWith(`.${blocked}`)

/** Blocked hosts, without what `keep` rejects. */
const blockedSites = (sites: ContextSites, keep: (blocked: string) => boolean): ContextSites =>
  Object.fromEntries(Object.entries(sites).filter(([blocked, on]) => on === false && keep(blocked)))

/** Whether `host` or a parent domain of it is blocked. */
export const isSiteBlocked = async (host: string): Promise<boolean> =>
  Object.keys(blockedSites(await getContextSites(), (blocked) => covers(blocked, host))).length > 0

/** Blocks `host` without `www.`, replacing the entries it covers. */
export const blockContextSite = async (host: string): Promise<void> => {
  const site = host.replace(/^www\./, "")
  await browser.storage.local.set({
    contextSites: {
      ...blockedSites(await getContextSites(), (blocked) => !covers(site, blocked)),
      [site]: false,
    },
  })
}

/** Unblocks this one entry. A parent domain can still block `host`. */
export const removeContextSite = async (host: string): Promise<void> => {
  const { [host]: _old, ...rest } = await getContextSites()
  await browser.storage.local.set({ contextSites: rest })
}
