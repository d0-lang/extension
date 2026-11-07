/** Server dialog's connect step: runs handshake() and maps its errors into what the user sees.
 *  `run(url)` is Connect; `continue()` retries the warned URL with its new key.
 *  `cancel()` drops an in-flight attempt when the dialog closes. */
import { handshake, type DictError, type HandshakeOk } from "$lib/dict"

/** The protocol locks the identity warning for 5 seconds. */
const IDENTITY_LOCK_SECONDS = 5

/** `details` is the technical message, shown only on request. */
export type ConnectFailure = { text: string; details: string | undefined }

const LOCAL_HOST = /^(localhost|127(\.\d+){3}|\[::1\])(:\d+)?(\/|$)/i

/** A bare host gets `https://`, or `http://` when it is this machine. */
const withScheme = (input: string): string => {
  const trimmed = input.trim()
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) {
    return trimmed
  }
  return `${LOCAL_HOST.test(trimmed) ? "http" : "https"}://${trimmed}`
}

const failureText = (cause: DictError): string => {
  switch (cause.kind) {
    case "invalid-url":
      return "Enter a server address, like https://dict.example.org."
    case "network":
      return "Could not reach this server. Check the address and your connection."
    case "http":
      return "The server answered with an error. It may be down, or this may not be a dictionary server."
    case "body":
      return "This does not look like a dictionary server."
    case "nonce":
      return "The server's answer did not match this request. Try again."
    default:
      return "Could not connect to this server."
  }
}

export class HandshakeSession {
  connecting = $state(false)
  failure = $state.raw<ConnectFailure | null>(null)
  identityUrls = $state.raw<Array<string> | null>(null)
  brokenUrls = $state.raw<Array<string> | null>(null)
  lockSeconds = $state(0)

  identityLocked = $derived(this.lockSeconds > 0)

  #attemptUrl = ""
  #pending: { url: string; key: string | undefined } | undefined
  #lockTimer: ReturnType<typeof setInterval> | undefined

  cancel = () => {
    this.connecting = false
    this.#clearLock()
  }

  /** The warnings describe the URL that was tried, so they end when the input changes. */
  clearWarnings = () => {
    this.failure = null
    this.identityUrls = null
    this.brokenUrls = null
    this.#pending = undefined
    this.#clearLock()
  }

  run = async (input: string, newKey?: string): Promise<HandshakeOk | undefined> => {
    const url = withScheme(input)
    this.connecting = true
    this.#attemptUrl = url
    this.failure = null
    this.identityUrls = null
    this.brokenUrls = null
    const result = await handshake(url, newKey)
    if (result.isOk()) {
      if (!this.connecting) {
        return
      }
      this.connecting = false
      return result.value
    }
    this.#fail(result.error)
  }

  continue = async (): Promise<HandshakeOk | undefined> =>
    this.#pending === undefined ? undefined : this.run(this.#pending.url, this.#pending.key)

  #clearLock = () => {
    if (this.#lockTimer !== undefined) {
      clearInterval(this.#lockTimer)
      this.#lockTimer = undefined
    }
    this.lockSeconds = 0
  }

  #startLock = () => {
    this.#clearLock()
    this.lockSeconds = IDENTITY_LOCK_SECONDS
    this.#lockTimer = setInterval(() => {
      this.lockSeconds -= 1
      if (this.lockSeconds <= 0) {
        this.#clearLock()
      }
    }, 1000)
  }

  #fail = (cause: DictError) => {
    if (!this.connecting) {
      return
    }
    this.connecting = false
    if (cause.kind === "identity") {
      this.identityUrls = cause.verificationUrls
      this.#pending = { url: this.#attemptUrl, key: cause.newKey }
      this.brokenUrls = null
      this.#startLock()
      return
    }
    if (cause.kind === "broken") {
      this.brokenUrls = cause.verificationUrls
      this.identityUrls = null
      this.#pending = undefined
      this.#clearLock()
      return
    }
    this.clearWarnings()
    this.failure = {
      text: failureText(cause),
      // The address hint already says everything.
      details: cause.kind === "invalid-url" ? undefined : cause.message,
    }
  }
}
