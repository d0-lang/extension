/** AnkiConnect's JSON API (version 6), which the Anki add-on serves on the user's own machine. */
import { ResultAsync, err, errAsync, ok, type Result } from "neverthrow"
import * as z from "zod/mini"

/** The add-on's own default. AnkiConnect Android listens there too. */
export const DEFAULT_ANKI_URL = "http://127.0.0.1:8765"

/** Anki answers at once or not at all, but adding a note waits for its audio to be stored. */
const REQUEST_TIMEOUT_MS = 10_000

/** Asking for access waits while the user answers Anki's dialog. */
const PERMISSION_TIMEOUT_MS = 120_000

export type AnkiError = {
  /**
   * `offline` is Anki closed or the add-on missing. `denied` is the add-on turning this browser away.
   * `key` is a missing or wrong API key. `anki` is any other error Anki names.
   */
  readonly kind: "offline" | "denied" | "key" | "anki" | "body"
  readonly message: string
}

const ankiError = (kind: AnkiError["kind"], message: string): AnkiError => ({ kind, message })

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

/** Where to reach AnkiConnect, and the API key the user set in its config, if any. */
export type AnkiTarget = { url: string; key: string | undefined }

const replySchema = z.object({ result: z.unknown(), error: z.nullable(z.string()) })

// The add-on's wording, which is the only way it tells a bad key apart.
const KEY_ERROR = "valid api key must be provided"

const post = ResultAsync.fromThrowable(
  (url: string, body: string, timeoutMs: number) =>
    fetch(url, { method: "POST", body, signal: AbortSignal.timeout(timeoutMs) }),
  (cause) => ankiError("offline", cause instanceof Error ? cause.message : String(cause)),
)

const readReply = (action: string, response: Response): ResultAsync<unknown, AnkiError> => {
  // An origin the add-on does not trust gets an empty 403 for everything but `requestPermission`.
  if (response.status === 403) {
    return errAsync(ankiError("denied", `${action} was refused`))
  }
  return ResultAsync.fromPromise(response.json(), () =>
    ankiError("body", `${action} returned an unexpected body`),
  ).andThen((body): Result<unknown, AnkiError> => {
    const reply = replySchema.safeParse(body)
    if (!reply.success) {
      return err(ankiError("body", `${action} returned an unexpected body`))
    }
    const { result, error } = reply.data
    if (error === null) {
      return ok(result)
    }
    return err(ankiError(error === KEY_ERROR ? "key" : "anki", error))
  })
}

/** Call one AnkiConnect action and check its result against `schema`. */
export const invoke = <S extends z.ZodMiniType>(
  target: AnkiTarget,
  action: string,
  schema: S,
  params?: Record<string, unknown>,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): ResultAsync<z.infer<S>, AnkiError> =>
  post(target.url, JSON.stringify({ action, version: 6, params, key: target.key }), timeoutMs)
    .andThen((response) => readReply(action, response))
    .andThen((result): Result<z.infer<S>, AnkiError> => {
      const parsed = schema.safeParse(result)
      return parsed.success
        ? ok(parsed.data as z.infer<S>)
        : err(ankiError("body", `${action} returned an unexpected result`))
    })

const permissionSchema = z.object({
  permission: z.enum(["granted", "denied"]),
  requireApikey: z.optional(z.boolean()),
})

/**
 * Ask the add-on to trust this browser. Its default settings already trust extensions;
 * otherwise Anki asks the user in a dialog, and this waits for the answer.
 * Ok with whether requests need an API key.
 */
export const requestPermission = (url: string): ResultAsync<{ needsKey: boolean }, AnkiError> =>
  invoke(
    { url, key: undefined },
    "requestPermission",
    permissionSchema,
    undefined,
    PERMISSION_TIMEOUT_MS,
  ).andThen(({ permission, requireApikey }) =>
    permission === "granted"
      ? ok({ needsKey: requireApikey === true })
      : err(ankiError("denied", "Anki did not give access")),
  )

export const deckNames = (target: AnkiTarget): ResultAsync<Array<string>, AnkiError> =>
  invoke(target, "deckNames", z.array(z.string()))

export const modelNames = (target: AnkiTarget): ResultAsync<Array<string>, AnkiError> =>
  invoke(target, "modelNames", z.array(z.string()))

/** Adds `note` and gives its id. */
export const addNote = (target: AnkiTarget, note: Record<string, unknown>): ResultAsync<number, AnkiError> =>
  invoke(target, "addNote", z.number(), { note })

/** Creates `name`, with `::` making it a subdeck. Ok when it already exists. */
export const createDeck = (target: AnkiTarget, name: string): ResultAsync<void, AnkiError> =>
  invoke(target, "createDeck", z.number(), { deck: name }).map(() => undefined)
