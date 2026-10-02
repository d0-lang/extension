import { getStoredServer, type BoundServer } from "../storage"
import { getKey, getMeta } from "./api"
import { HandshakeError, SignatureError } from "./errors"
import type { ServerMeta } from "./types"

export const handshake = async (
  baseUrl: string,
  stored: BoundServer | undefined = undefined,
  acceptKey: string | undefined = undefined,
): Promise<{ key: string; meta: ServerMeta }> => {
  const key = acceptKey ?? await getKey(baseUrl)
  if (acceptKey === undefined && stored !== undefined && stored.key !== key) {
    throw new HandshakeError("identity", stored.verificationUrls, key)
  }
  try {
    const meta = await getMeta(baseUrl, key)
    return { key, meta }
  } catch (cause) {
    if (cause instanceof SignatureError) {
      throw new HandshakeError("failed")
    }
    throw cause
  }
}

export const connect = async (baseUrl: string, acceptKey: string | undefined = undefined) => {
  const stored = await getStoredServer(baseUrl)
  return handshake(baseUrl, stored, acceptKey)
}
