import { verifyEd25519 } from "./crypto"
import { SignatureError } from "./errors"
import { endpoint, readJson } from "./http"
import type { LookupResult, ServerMeta } from "./types"

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
