import { getStoredServer, normalizeServerUrl, type BoundServer } from "./storage"

export const DEFAULT_BASE_URL = "http://127.0.0.1:3000"

export type ServerMeta = {
  name: string
  nonce: string
  languages: Array<string>
  verification_urls: Array<string>
}

export type LookupResult = {
  word: string
  translation: string
}

export class SignatureError extends Error {
  readonly kind = "signature" as const

  constructor() {
    super("get-meta signature does not match")
    this.name = "SignatureError"
  }
}

export class HandshakeError extends Error {
  readonly kind: "identity" | "failed"
  readonly verificationUrls: Array<string>

  constructor(kind: "identity" | "failed", verificationUrls: Array<string> = []) {
    super(kind === "identity" ? "Server identity may have changed" : "Handshake failed")
    this.name = "HandshakeError"
    this.kind = kind
    this.verificationUrls = verificationUrls
  }
}

const base64ToBytes = (value: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

const verifyEd25519 = async (
  publicKeyBase64: string,
  body: Uint8Array,
  signatureBase64: string,
): Promise<boolean> => {
  const message = new Uint8Array(body.byteLength)
  message.set(body)
  const publicKey = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(publicKeyBase64),
    "Ed25519",
    false,
    ["verify"],
  )
  return crypto.subtle.verify(
    "Ed25519",
    publicKey,
    base64ToBytes(signatureBase64),
    message,
  )
}

const endpoint = (baseUrl: string, path: string): string =>
  `${normalizeServerUrl(baseUrl)}${path}`

const readJson = async <T>(response: Response, label: string): Promise<T> => {
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

const asStringArray = (value: unknown): Array<string> =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []

export const getKey = async (baseUrl: string): Promise<string> => {
  const body = await readJson<{ key?: string }>(
    await fetch(endpoint(baseUrl, "/v1/get-key")),
    "get-key",
  )
  if (typeof body.key !== "string" || body.key.length === 0) {
    throw new Error("get-key returned no key")
  }
  return body.key
}

export const getMeta = async (baseUrl: string, publicKey: string): Promise<ServerMeta> => {
  const nonce = crypto.randomUUID()
  const response = await fetch(endpoint(baseUrl, "/v1/get-meta"), {
    headers: { "X-Nonce": nonce },
  })
  if (!response.ok) {
    throw new Error(`get-meta failed: ${response.status}`)
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  const signature = response.headers.get("x-signature")
  if (signature === null || signature.length === 0) {
    throw new Error("get-meta missing X-Signature")
  }
  if (!(await verifyEd25519(publicKey, bytes, signature))) {
    throw new SignatureError()
  }

  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as {
    name?: unknown
    nonce?: unknown
    languages?: unknown
    verification_urls?: unknown
  }
  if (parsed.nonce !== nonce) {
    throw new Error("get-meta nonce does not match")
  }
  if (typeof parsed.name !== "string" || parsed.name.length === 0) {
    throw new Error("get-meta missing name")
  }

  return {
    name: parsed.name,
    nonce: parsed.nonce,
    languages: asStringArray(parsed.languages),
    verification_urls: asStringArray(parsed.verification_urls),
  }
}

export const handshake = async (
  baseUrl: string,
  stored: BoundServer | undefined = undefined,
): Promise<{ key: string; meta: ServerMeta }> => {
  const key = stored?.key ?? await getKey(baseUrl)
  try {
    const meta = await getMeta(baseUrl, key)
    return { key, meta }
  } catch (cause) {
    if (cause instanceof SignatureError) {
      const urls = stored?.verificationUrls ?? []
      throw new HandshakeError(urls.length > 0 ? "identity" : "failed", urls)
    }
    throw cause
  }
}

export const lookup = async (
  baseUrl: string,
  word: string,
  lang: string,
): Promise<LookupResult> => {
  const payload = encodeURIComponent(JSON.stringify({ word, lang }))
  const body = await readJson<LookupResult>(
    await fetch(endpoint(baseUrl, `/v1/lookup?payload=${payload}`)),
    "lookup",
  )
  if (typeof body.word !== "string" || typeof body.translation !== "string") {
    throw new Error("lookup returned an unexpected body")
  }
  return body
}

export const connect = async (baseUrl: string) => {
  const stored = await getStoredServer(baseUrl)
  return handshake(baseUrl, stored)
}
