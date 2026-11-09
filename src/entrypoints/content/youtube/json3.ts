/** YouTube's caption format, as the player downloads it from `/api/timedtext` with `fmt=json3`. */
import * as z from "zod/mini"

const segSchema = z.object({
  utf8: z.string(),
  /** From the event's start. Only auto captions time their words. */
  tOffsetMs: z.optional(z.number()),
  /** Auto captions also start the word's text with `>>`. */
  isSpeakerChange: z.optional(z.number()),
})

const eventSchema = z.object({
  tStartMs: z._default(z.number(), 0),
  dDurationMs: z._default(z.number(), 0),
  /** Set on the line breaks that make auto captions roll up. */
  aAppend: z.optional(z.number()),
  segs: z.optional(z.array(segSchema)),
})

const json3Schema = z.object({
  events: z._default(z.array(eventSchema), []),
})

export type Json3 = z.infer<typeof json3Schema>

/** The track in `body`, or `undefined` when it is not json3. */
export const parseJson3 = (body: unknown): Json3 | undefined => {
  const parsed = json3Schema.safeParse(body)
  return parsed.success ? parsed.data : undefined
}
