/** Extension storage: lookup toggle, theme, bound servers, and language → server URL.
 *  `bindServer` writes one server record and remaps the selected language pairs onto it. */
import { ResultAsync } from "neverthrow"

/** Language pair advertised by a dictionary server, e.g. `de_en`. */
export type LanguagePair = string

const fromUnknown = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause))

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

/** `system` follows the OS colour scheme. */
export type Theme = "system" | "light" | "dark"

const themes: ReadonlyArray<string> = ["system", "light", "dark"] satisfies Array<Theme>

const empty = {
  lookupEnabled: true,
  theme: "system" as Theme,
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

export const getTheme = async (): Promise<Theme> => {
  const { theme } = await browser.storage.local.get("theme")
  return typeof theme === "string" && themes.includes(theme) ? theme as Theme : empty.theme
}

export const setTheme = async (theme: Theme): Promise<void> => {
  await browser.storage.local.set({ theme })
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
  return servers[url]
}

/** Delete the record, with its pinned key, and every language mapped to it. */
export const removeServer = (url: string): ResultAsync<void, Error> =>
  ResultAsync.fromPromise(
    (async () => {
      const [servers, serverByLang] = await Promise.all([getServers(), getServerByLang()])
      const { [url]: _removed, ...nextServers } = servers

      await browser.storage.local.set({
        servers: nextServers,
        serverByLang: Object.fromEntries(
          Object.entries(serverByLang).filter(([, mapped]) => mapped !== url),
        ),
      })
    })(),
    fromUnknown,
  )

/**
 * Make `selectedLanguages` the only languages mapped to `server`.
 * `movedFrom` is purged: its record and every language mapped to it.
 */
export const bindServer = (
  server: BoundServer,
  selectedLanguages: Array<LanguagePair>,
  movedFrom: string | undefined = undefined,
): ResultAsync<void, Error> =>
  ResultAsync.fromPromise(
    (async () => {
      const { servers = empty.servers, serverByLang = empty.serverByLang } = await browser.storage.local.get([
        "servers",
        "serverByLang",
      ]) as { servers?: Servers; serverByLang?: ServerByLang }

      const nextServerByLang = Object.fromEntries(
        Object.entries(serverByLang).filter(
          ([, url]) => url !== server.url && url !== movedFrom,
        ),
      )
      for (const lang of selectedLanguages) {
        nextServerByLang[lang] = server.url
      }

      const nextServers = { ...servers, [server.url]: server }
      if (movedFrom !== undefined) {
        delete nextServers[movedFrom]
      }

      await browser.storage.local.set({
        servers: nextServers,
        serverByLang: nextServerByLang,
      })
    })(),
    fromUnknown,
  )
