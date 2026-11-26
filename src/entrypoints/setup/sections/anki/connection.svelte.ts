import type { ResultAsync } from "neverthrow"
import { deckNames, requestPermission, type AnkiError } from "$lib/anki/connect"
import { ensureNoteType } from "$lib/anki/note-type"
import { getAnkiTarget, setAnkiKey } from "$lib/storage"

/** `checking` until Anki first answers. `key` waits for the user to enter the add-on's API key. */
export type AnkiStatus =
  | { kind: "checking" }
  | { kind: "connected"; decks: Array<string> }
  | { kind: "key" }
  | { kind: "error"; error: AnkiError }

/** Whether Anki answers this settings page, and its decks once it does. */
export class AnkiConnection {
  status = $state<AnkiStatus>({ kind: "checking" })
  busy = $state(false)

  /** Reads the decks with the stored key. Asks nothing of the user. */
  check = async (): Promise<void> => {
    const target = await getAnkiTarget()
    await this.settle(deckNames(target))
  }

  /**
   * Asks Anki for access, which may show a dialog there, then adds the note type if it is missing.
   * A key, when given, is stored first.
   */
  connect = async (key?: string): Promise<void> => {
    this.busy = true
    if (key !== undefined) {
      await setAnkiKey(key.trim() === "" ? undefined : key.trim())
    }
    const target = await getAnkiTarget()
    const granted = await requestPermission(target.url)
    if (granted.isOk() && granted.value.needsKey && target.key === undefined) {
      this.status = { kind: "key" }
      this.busy = false
      return
    }
    await this.settle(granted.asyncAndThen(() => ensureNoteType(target)).andThen(() => deckNames(target)))
    this.busy = false
  }

  private settle = async (decks: ResultAsync<Array<string>, AnkiError>): Promise<void> => {
    const result = await decks
    this.status = result.match(
      (names): AnkiStatus => ({ kind: "connected", decks: names }),
      (error): AnkiStatus => (error.kind === "key" ? { kind: "key" } : { kind: "error", error }),
    )
  }
}

/** What to tell the user about `error`. */
export const ankiErrorText = (error: AnkiError): string => {
  switch (error.kind) {
    case "offline":
      return "Anki is not answering. Open Anki, and install the AnkiConnect add-on if you have not."
    case "denied":
      return "AnkiConnect turned this browser away. Connect again and allow it in the dialog Anki shows."
    case "key":
      return "AnkiConnect needs its API key."
    case "anki":
      return `Anki said: ${error.message}`
    case "body":
      return "AnkiConnect answered in a way this version does not understand. Update the add-on."
  }
}
