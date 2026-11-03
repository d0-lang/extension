/** Extension storage: lookup toggle, theme, bound servers, language → server URL, and server issues.
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

/** A check that needs the user: the key changed, or the signature failed. The old key and data stay until then. */
export type ServerIssue = { kind: "identity" | "broken" }
/** Server URL → its unresolved issue. */
export type ServerIssues = Record<string, ServerIssue>

/** `system` follows the OS colour scheme. */
export type Theme = "system" | "light" | "dark"

const themes: ReadonlyArray<string> = ["system", "light", "dark"] satisfies Array<Theme>

const empty = {
  lookupEnabled: true,
  theme: "system" as Theme,
  servers: {} as Servers,
  serverByLang: {} as ServerByLang,
  serverIssues: {} as ServerIssues,
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

export const getServerIssues = async (): Promise<ServerIssues> => {
  const { serverIssues } = await browser.storage.local.get("serverIssues")
  return serverIssues !== undefined && typeof serverIssues === "object" && !Array.isArray(serverIssues)
    ? serverIssues as ServerIssues
    : empty.serverIssues
}

export const setServerIssue = (url: string, issue: ServerIssue): ResultAsync<void, Error> =>
  ResultAsync.fromPromise(
    (async () => {
      const serverIssues = await getServerIssues()
      await browser.storage.local.set({ serverIssues: { ...serverIssues, [url]: issue } })
    })(),
    fromUnknown,
  )

const withoutIssues = (serverIssues: ServerIssues, urls: ReadonlyArray<string | undefined>): ServerIssues =>
  Object.fromEntries(Object.entries(serverIssues).filter(([url]) => !urls.includes(url)))

export const getStoredServer = async (url: string): Promise<BoundServer | undefined> => {
  const servers = await getServers()
  return servers[url]
}

/** Delete the record, with its pinned key, its issue, and every language mapped to it. */
export const removeServer = (url: string): ResultAsync<void, Error> =>
  ResultAsync.fromPromise(
    (async () => {
      const [servers, serverByLang, serverIssues] = await Promise.all([
        getServers(),
        getServerByLang(),
        getServerIssues(),
      ])
      const { [url]: _removed, ...nextServers } = servers

      await browser.storage.local.set({
        servers: nextServers,
        serverByLang: Object.fromEntries(
          Object.entries(serverByLang).filter(([, mapped]) => mapped !== url),
        ),
        serverIssues: withoutIssues(serverIssues, [url]),
      })
    })(),
    fromUnknown,
  )

/**
 * Make `selectedLanguages` the only languages mapped to `server`, and clear its issue.
 * `movedFrom` is purged: its record, its issue, and every language mapped to it.
 */
export const bindServer = (
  server: BoundServer,
  selectedLanguages: Array<LanguagePair>,
  movedFrom: string | undefined = undefined,
): ResultAsync<void, Error> =>
  ResultAsync.fromPromise(
    (async () => {
      const [servers, serverByLang, serverIssues] = await Promise.all([
        getServers(),
        getServerByLang(),
        getServerIssues(),
      ])

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
        serverIssues: withoutIssues(serverIssues, [server.url, movedFrom]),
      })
    })(),
    fromUnknown,
  )
