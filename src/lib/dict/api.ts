import { normalizeServerUrl } from "../storage"
import { verifyEd25519 } from "./crypto"
import { SignatureError } from "./errors"
import {
  lookupResultSchema,
  parseBody,
  publicKeySchema,
  serverMetaSchema,
  type LookupResult,
  type ServerMeta,
} from "./schemas"

const endpoint = (baseUrl: string, path: string): string =>
  `${normalizeServerUrl(baseUrl)}${path}`

export const getKey = async (baseUrl: string): Promise<string> => {
  const response = await fetch(endpoint(baseUrl, "/v1/get-key"))
  if (!response.ok) {
    throw new Error(`get-key failed: ${response.status}`)
  }
  const { key } = parseBody(publicKeySchema, await response.json(), "get-key")
  return key
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

  const meta = parseBody(
    serverMetaSchema,
    JSON.parse(new TextDecoder().decode(bytes)) as unknown,
    "get-meta",
  )
  if (meta.nonce !== nonce) {
    throw new Error("get-meta nonce does not match")
  }
  return meta
}

export const lookup = async (
  baseUrl: string,
  word: string,
  lang: string,
): Promise<LookupResult> => {
  const payload = encodeURIComponent(JSON.stringify({ word, lang }))
  const response = await fetch(endpoint(baseUrl, `/v1/lookup?payload=${payload}`))
  if (!response.ok) {
    throw new Error(`lookup failed: ${response.status}`)
  }
  return parseBody(lookupResultSchema, await response.json(), "lookup")
}
