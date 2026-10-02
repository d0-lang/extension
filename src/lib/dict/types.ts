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
