import { err, ok, type Result } from "neverthrow"
import { invalidUrlError, type DictError } from "./errors"

const parseHttpUrl = (value: string): URL | undefined => {
  const url = URL.parse(value)
  return url !== null && (url.protocol === "https:" || url.protocol === "http:") ? url : undefined
}

export const isHttpUrl = (value: string): boolean => parseHttpUrl(value) !== undefined

/**
 * Canonical server URL, the key a server is pinned under. Keeps a subpath.
 * Spellings of one address (host case, default port, trailing slash) give one result.
 */
export const normalizeServerUrl = (value: string): Result<string, DictError> => {
  const url = parseHttpUrl(value)
  if (
    url === undefined ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    return err(invalidUrlError())
  }
  return ok(`${url.origin}${url.pathname.replace(/\/+$/, "")}`)
}

export const isDowngrade = (from: string, to: string): boolean =>
  from.startsWith("https:") && to.startsWith("http:")
