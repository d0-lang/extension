export const DEFAULT_BASE_URL = "http://127.0.0.1:3000"

export type ServerMeta = {
  name: string
  nonce: string
  languages: Array<string>
}

export type LookupResult = {
  word: string
  translation: string
}

export type LookupRun = {
  meta: ServerMeta
  result: LookupResult
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
  `${baseUrl.replace(/\/$/, "")}${path}`

const readJson = async <T>(response: Response, label: string): Promise<T> => {
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

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
    throw new Error("get-meta signature does not match the stored key")
  }

  const meta = JSON.parse(new TextDecoder().decode(bytes)) as ServerMeta
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
  const body = await readJson<LookupResult>(
    await fetch(endpoint(baseUrl, `/v1/lookup?payload=${payload}`)),
    "lookup",
  )
  if (typeof body.word !== "string" || typeof body.translation !== "string") {
    throw new Error("lookup returned an unexpected body")
  }
  return body
}

export const runLookup = async (
  baseUrl: string,
  word: string,
  lang: string,
): Promise<LookupRun> => {
  const key = await getKey(baseUrl)
  const meta = await getMeta(baseUrl, key)
  const result = await lookup(baseUrl, word, lang)
  return { meta, result }
}
