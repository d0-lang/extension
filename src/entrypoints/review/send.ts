/** Sends a kept word to Anki as a DaDict note, with its recording. */
import { ResultAsync, errAsync, okAsync } from "neverthrow"
import { addNote, createDeck, type AnkiError } from "$lib/anki/connect"
import { ensureNoteType, NOTE_TYPE } from "$lib/anki/note-type"
import { toBase64 } from "$lib/base64"
import { playableAudio } from "$lib/dict/entries"
import { requestAudio } from "$lib/messages"
import {
  ankiLanguage,
  getAnkiLanguages,
  getAnkiTarget,
  removeSeed,
  type CardDraft,
  type CardSeed,
} from "$lib/storage"
import { noteFields } from "./fields"

const AUDIO_EXTENSION = /\.(mp3|ogg|oga|opus|wav|m4a|webm|flac)$/i

type Recording = { data: string; filename: string; fields: Array<string> }

/**
 * The entry's recording, fetched by the background as the popover's are, since Anki's own download is turned away by
 * hosts like Wikimedia. A card without one is still worth sending, so a failed fetch is no recording.
 */
const recording = (seed: CardSeed, url: string | undefined): ResultAsync<Recording | undefined, never> => {
  if (url === undefined) {
    return okAsync(undefined)
  }
  const extension = AUDIO_EXTENSION.exec(new URL(url).pathname)?.[1]?.toLowerCase() ?? "mp3"
  return requestAudio(url)
    .map((buffer): Recording | undefined => ({
      data: toBase64(new Uint8Array(buffer)),
      filename: `dadict-${seed.id}.${extension}`,
      fields: ["Audio"],
    }))
    .orElse(() => okAsync(undefined))
}

/**
 * Adds the card to the deck its language goes to, making the deck and the note type when Anki lacks them, and lets
 * the kept word go once Anki has it. Anki's duplicate check is skipped: the user was warned and kept it anyway.
 */
export const sendCard = (seed: CardSeed, draft: CardDraft): ResultAsync<number, AnkiError> =>
  ResultAsync.fromSafePromise(Promise.all([getAnkiTarget(), getAnkiLanguages()])).andThen(
    ([target, languages]) => {
      const { deck, ipa } = ankiLanguage(languages, seed.lang.split("_", 1)[0] ?? seed.lang)
      const fields = noteFields(seed, draft, ipa)
      const entry = seed.entries[draft.entry]
      if (fields === undefined || entry === undefined) {
        return errAsync<number, AnkiError>({ kind: "anki", message: "The kept word has no such entry" })
      }
      return ensureNoteType(target)
        .andThen(() => createDeck(target, deck))
        .andThen(() => recording(seed, playableAudio(entry, seed.server)?.url))
        .andThen((audio) =>
          addNote(target, {
            deckName: deck,
            modelName: NOTE_TYPE,
            fields,
            tags: ["dadict", seed.lang],
            options: { allowDuplicate: true },
            ...(audio === undefined ? {} : { audio: [audio] }),
          }),
        )
        .andThen((id) => ResultAsync.fromSafePromise(removeSeed(seed.id)).map(() => id))
    },
  )
