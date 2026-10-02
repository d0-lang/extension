export type BoundServer = {
  url: string
  key: string
  name: string
  languages: Array<string>
  verificationUrls: Array<string>
}

export type Defaults = Record<string, string>
export type Servers = Record<string, BoundServer>

export const normalizeServerUrl = (value: string): string => value.trim().replace(/\/+$/, "")

const empty = {
  lookupEnabled: false,
  servers: {} as Servers,
  defaults: {} as Defaults,
}

export const getLookupEnabled = async (): Promise<boolean> => {
  const { lookupEnabled } = await browser.storage.local.get("lookupEnabled")
  return typeof lookupEnabled === "boolean" ? lookupEnabled : empty.lookupEnabled
}

export const setLookupEnabled = async (lookupEnabled: boolean): Promise<void> => {
  await browser.storage.local.set({ lookupEnabled })
}

export const getServers = async (): Promise<Servers> => {
  const { servers } = await browser.storage.local.get("servers")
  return servers !== undefined && typeof servers === "object" && !Array.isArray(servers)
    ? servers as Servers
    : empty.servers
}

export const getDefaults = async (): Promise<Defaults> => {
  const { defaults } = await browser.storage.local.get("defaults")
  return defaults !== undefined && typeof defaults === "object" && !Array.isArray(defaults)
    ? defaults as Defaults
    : empty.defaults
}

export const getStoredServer = async (url: string): Promise<BoundServer | undefined> => {
  const servers = await getServers()
  return servers[normalizeServerUrl(url)]
}

export const bindServer = async (
  server: BoundServer,
  selectedLanguages: Array<string>,
): Promise<void> => {
  const url = normalizeServerUrl(server.url)
  const { servers = empty.servers, defaults = empty.defaults } = await browser.storage.local.get([
    "servers",
    "defaults",
  ]) as { servers?: Servers; defaults?: Defaults }

  const nextDefaults = { ...defaults }
  for (const lang of selectedLanguages) {
    nextDefaults[lang] = url
  }

  await browser.storage.local.set({
    servers: {
      ...servers,
      [url]: { ...server, url },
    },
    defaults: nextDefaults,
  })
}
