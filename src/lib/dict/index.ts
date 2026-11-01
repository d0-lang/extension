export { getKey, getMeta, lookup } from "./api"
export type { DictError, HandshakeError, SignatureError } from "./errors"
export { handshake, type HandshakeOk } from "./handshake"
export { boundLanguages, lookupWord, type LookupOutcome } from "./lookup"
export type { LookupHints } from "./rank"
export {
  DEFAULT_BASE_URL,
  type LookupEntry,
  type LookupResult,
  type ServerMeta,
} from "./types"
