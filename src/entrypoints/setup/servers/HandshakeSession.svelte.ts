/** Add-dialog session: runs handshake() and maps identity/broken into UI state.
 *  `run(url)` is Connect; `continue()` retries the warned URL with its new key.
 *  `cancel()` drops an in-flight attempt when the dialog closes. */
import {
  handshake,
  type DictError,
  type HandshakeOk,
} from "$lib/dict";

export class HandshakeSession {
  connecting = $state(false);
  genericError = $state("");
  identityUrls = $state.raw<Array<string> | null>(null);
  brokenUrls = $state.raw<Array<string> | null>(null);
  identityLocked = $state(false);

  #attemptUrl = "";
  #pending: { url: string; key: string | undefined } | undefined;
  #lockTimer: ReturnType<typeof setTimeout> | undefined;

  cancel = () => {
    this.connecting = false;
    this.#clearLock();
  };

  /** The warnings describe the URL that was tried, so they end when the input changes. */
  clearWarnings = () => {
    this.identityUrls = null;
    this.brokenUrls = null;
    this.#pending = undefined;
    this.#clearLock();
  };

  run = async (
    url: string,
    newKey?: string,
  ): Promise<HandshakeOk | undefined> => {
    this.connecting = true;
    this.#attemptUrl = url;
    this.genericError = "";
    this.identityUrls = null;
    this.brokenUrls = null;
    const result = await handshake(url, newKey);
    if (result.isOk()) {
      if (!this.connecting) {
        return;
      }
      this.connecting = false;
      return result.value;
    }
    this.#fail(result.error);
  };

  continue = async (): Promise<HandshakeOk | undefined> =>
    this.#pending === undefined
      ? undefined
      : this.run(this.#pending.url, this.#pending.key);

  #clearLock = () => {
    if (this.#lockTimer !== undefined) {
      clearTimeout(this.#lockTimer);
      this.#lockTimer = undefined;
    }
    this.identityLocked = false;
  };

  #startLock = () => {
    this.#clearLock();
    this.identityLocked = true;
    this.#lockTimer = setTimeout(() => {
      this.identityLocked = false;
      this.#lockTimer = undefined;
    }, 5000);
  };

  #fail = (cause: DictError) => {
    if (!this.connecting) {
      return;
    }
    this.connecting = false;
    if (cause.kind === "identity") {
      this.identityUrls = cause.verificationUrls;
      this.#pending = { url: this.#attemptUrl, key: cause.newKey };
      this.brokenUrls = null;
      this.#startLock();
      return;
    }
    if (cause.kind === "broken") {
      this.brokenUrls = cause.verificationUrls;
      this.identityUrls = null;
      this.#pending = undefined;
      this.#clearLock();
      return;
    }
    this.clearWarnings();
    this.genericError =
      cause.kind === "failed" ? "Handshake failed." : cause.message;
  };
}
