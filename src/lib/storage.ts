/** Language pair advertised by a dictionary server, e.g. `de_en`. */
export type LanguagePair = string

export type BoundServer = {
  url: string
  /** Ed25519 public key from `/v1/get-key` (base64). */
  key: string
  name: string
  languages: Array<LanguagePair>
  verificationUrls: Array<string>
}

/** Which bound server URL to use for each language pair. */
export type ServerByLang = Record<LanguagePair, string>
/** Normalized server URL → bound record. Key matches `BoundServer.url`. */
export type Servers = Record<string, BoundServer>

export const normalizeServerUrl = (value: string): string => value.trim().replace(/\/+$/, "")

const empty = {
  lookupEnabled: false,
  servers: {} as Servers,
  serverByLang: {} as ServerByLang,
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

export const getServerByLang = async (): Promise<ServerByLang> => {
  const { serverByLang } = await browser.storage.local.get("serverByLang")
  return serverByLang !== undefined && typeof serverByLang === "object" && !Array.isArray(serverByLang)
    ? serverByLang as ServerByLang
    : empty.serverByLang
}

export const getStoredServer = async (url: string): Promise<BoundServer | undefined> => {
  const servers = await getServers()
  return servers[normalizeServerUrl(url)]
}

export const bindServer = async (
  server: BoundServer,
  selectedLanguages: Array<LanguagePair>,
): Promise<void> => {
  const url = normalizeServerUrl(server.url)
  const { servers = empty.servers, serverByLang = empty.serverByLang } = await browser.storage.local.get([
    "servers",
    "serverByLang",
  ]) as { servers?: Servers; serverByLang?: ServerByLang }

  const nextServerByLang = { ...serverByLang }
  for (const lang of selectedLanguages) {
    nextServerByLang[lang] = url
  }

  await browser.storage.local.set({
    servers: {
      ...servers,
      [url]: { ...server, url },
    },
    serverByLang: nextServerByLang,
  })
}
