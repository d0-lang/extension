/**
 * Bound servers, which server answers each language, and unresolved server issues.
 * `bindServer` writes one server record and remaps the selected language pairs onto it.
 */
import { ResultAsync } from "neverthrow"
import { toError } from "../errors"
import { getServerLabels, type ServerLabels } from "./labels"

/** Language pair advertised by a dictionary server, e.g. `de_en`. */
export type LanguagePair = string

export type BoundServer = {
  url: string
  /** Ed25519 public key from `/v1/get-key` (base64). */
  key: string
  name: string
  languages: Array<LanguagePair>
  verificationUrls: Array<string>
  /** Protocol features from the last verified meta. Missing on records stored before features were kept. */
  features?: Array<string>
  /** Whose sentences it gets, if it lists the `context` feature. Missing on records stored before it was asked. */
  context?: ContextSending
  /**
   * The policies the user last accepted. `null` is a server without them, accepted for testing.
   * Missing on records stored before policies were read.
   */
  legal?: AcceptedLegal | null
  /** Whose material the answers are built from, from the last verified meta. Missing on records stored before sources were read. */
  sources?: Array<CreditSource>
}

/** A source the server credits. `languages` unset means every pair. */
export type CreditSource = {
  name: string
  url: string
  license?: string
  licenseUrl?: string
  languages?: Array<LanguagePair>
}

/** Links and hashes of a server's privacy policy and terms of service, as the user accepted them. */
export type AcceptedLegal = { privacyLink: string; privacyHash: string; tosLink: string; tosHash: string }

/** Which sites a server gets the sentence around the word from. `unblocked` is every site but the blocked ones. */
export type ContextSending = "all" | "unblocked" | "none"

/** What a server was set to, with the default for servers bound before it was asked. */
export const contextSending = (server: BoundServer): ContextSending => server.context ?? "unblocked"

/** Which bound server URL to use for each language pair. */
export type ServerByLang = Record<LanguagePair, string>
/** Normalized server URL → bound record. Key matches `BoundServer.url`. */
export type Servers = Record<string, BoundServer>

/**
 * A check that needs the user: the key changed, the signature failed, or the policies changed.
 * The old key and data stay until then, and lookups to the server pause.
 */
export type ServerIssue = { kind: "identity" | "broken" | "legal" }
/** Server URL → its unresolved issue. */
export type ServerIssues = Record<string, ServerIssue>

const empty = {
  servers: {} as Servers,
  serverByLang: {} as ServerByLang,
  serverIssues: {} as ServerIssues,
}

export const getServers = async (): Promise<Servers> => {
  const { servers } = await browser.storage.local.get("servers")
  return servers !== undefined && typeof servers === "object" && !Array.isArray(servers)
    ? (servers as Servers)
    : empty.servers
}

export const getServerByLang = async (): Promise<ServerByLang> => {
  const { serverByLang } = await browser.storage.local.get("serverByLang")
  return serverByLang !== undefined && typeof serverByLang === "object" && !Array.isArray(serverByLang)
    ? (serverByLang as ServerByLang)
    : empty.serverByLang
}

export const getServerIssues = async (): Promise<ServerIssues> => {
  const { serverIssues } = await browser.storage.local.get("serverIssues")
  return serverIssues !== undefined && typeof serverIssues === "object" && !Array.isArray(serverIssues)
    ? (serverIssues as ServerIssues)
    : empty.serverIssues
}

export const setServerIssue = (url: string, issue: ServerIssue): ResultAsync<void, Error> =>
  ResultAsync.fromPromise(
    (async () => {
      const serverIssues = await getServerIssues()
      await browser.storage.local.set({ serverIssues: { ...serverIssues, [url]: issue } })
    })(),
    toError,
  )

const withoutUrls = <T extends ServerIssues | ServerLabels>(
  byUrl: T,
  urls: ReadonlyArray<string | undefined>,
): T => Object.fromEntries(Object.entries(byUrl).filter(([url]) => !urls.includes(url))) as T

export const getStoredServer = async (url: string): Promise<BoundServer | undefined> => {
  const servers = await getServers()
  return servers[url]
}

/** Delete the record, with its pinned key, its issue, its label explanations, and every language mapped to it. */
export const removeServer = (url: string): ResultAsync<void, Error> =>
  ResultAsync.fromPromise(
    (async () => {
      const [servers, serverByLang, serverIssues, serverLabels] = await Promise.all([
        getServers(),
        getServerByLang(),
        getServerIssues(),
        getServerLabels(),
      ])
      const { [url]: _removed, ...nextServers } = servers

      await browser.storage.local.set({
        servers: nextServers,
        serverByLang: Object.fromEntries(Object.entries(serverByLang).filter(([, mapped]) => mapped !== url)),
        serverIssues: withoutUrls(serverIssues, [url]),
        serverLabels: withoutUrls(serverLabels, [url]),
      })
    })(),
    toError,
  )

/**
 * Make `selectedLanguages` the only languages mapped to `server`, and clear its issue.
 * `movedFrom` is purged: its record, its issue, its label explanations, and every language mapped to it.
 */
export const bindServer = (
  server: BoundServer,
  selectedLanguages: Array<LanguagePair>,
  movedFrom: string | undefined = undefined,
): ResultAsync<void, Error> =>
  ResultAsync.fromPromise(
    (async () => {
      const [servers, serverByLang, serverIssues, serverLabels] = await Promise.all([
        getServers(),
        getServerByLang(),
        getServerIssues(),
        getServerLabels(),
      ])

      const nextServerByLang = Object.fromEntries(
        Object.entries(serverByLang).filter(([, url]) => url !== server.url && url !== movedFrom),
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
        serverIssues: withoutUrls(serverIssues, [server.url, movedFrom]),
        serverLabels: withoutUrls(serverLabels, [movedFrom]),
      })
    })(),
    toError,
  )
