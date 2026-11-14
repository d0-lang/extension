import { err, ok, type Result } from "neverthrow"
import * as z from "zod/mini"
import { isEd25519Key } from "./crypto"
import { bodyError, type DictError } from "./errors"
import { isHttpUrl, isHttpsUrl } from "./url"

const httpUrlSchema = z.string().check(z.refine(isHttpUrl))
const httpsUrlSchema = z.string().check(z.refine(isHttpsUrl))

// These codes become object keys in storage, so a code like `__proto__` must not pass.
const languagePairSchema = z.string().check(z.regex(/^[a-z]+_[a-z]+$/))

export const publicKeySchema = z.object({
  key: z.string().check(z.refine(isEd25519Key)),
})

/** The protocol's cap on a change summary. */
export const LEGAL_CHANGE_MAX = 500

// Lowercase only, so the same hash never compares as a different one.
const legalHashSchema = z.string().check(z.regex(/^[0-9a-f]{64}$/))
// A summary over the cap or of the wrong type is dropped, not the policy.
const legalChangeSchema = z.catch(z.optional(z.string().check(z.maxLength(LEGAL_CHANGE_MAX))), undefined)

const legalSchema = z.object({
  privacy_link: httpUrlSchema,
  privacy_hash: legalHashSchema,
  privacy_change: legalChangeSchema,
  tos_link: httpUrlSchema,
  tos_hash: legalHashSchema,
  tos_change: legalChangeSchema,
})

/** The protocol's cap on a source's `name` and on its `license`. */
export const SOURCE_TEXT_MAX = 40

const sourceTextSchema = z.string().check(z.minLength(1), z.maxLength(SOURCE_TEXT_MAX))

const sourceSchema = z.object({
  name: sourceTextSchema,
  url: httpsUrlSchema,
  // A bad licence is dropped, not the credit.
  license: z.catch(z.optional(sourceTextSchema), undefined),
  license_url: z.catch(z.optional(httpsUrlSchema), undefined),
  languages: z.optional(z.array(languagePairSchema)),
})

// A malformed source is dropped on its own, so it does not cost the others their credit.
const sourcesSchema = z.catch(
  z.optional(
    z.pipe(
      z.array(z.unknown()),
      z.transform((items) =>
        items.flatMap((item) => {
          const source = sourceSchema.safeParse(item)
          return source.success ? [source.data] : []
        }),
      ),
    ),
  ),
  undefined,
)

export const serverMetaSchema = z.object({
  name: z.string().check(z.minLength(1)),
  nonce: z.string(),
  languages: z._default(z.array(languagePairSchema), []),
  verification_urls: z._default(z.array(httpUrlSchema), []),
  features: z._default(z.array(z.string()), []),
  // A malformed section counts as none, which warns rather than trusts.
  legal: z.catch(z.optional(legalSchema), undefined),
  sources: sourcesSchema,
})

/** Domain-move body instead of metadata. Same signature/nonce rules; same signing key. */
export const newSourceSchema = z.object({
  nonce: z.string(),
  new_source: z.string().check(z.minLength(1)),
})

const lookupEntrySchema = z.object({
  lemma: z.string(),
  pos: z.string(),
  // Display extras: a malformed one must not cost the entry.
  labels: z.catch(z.optional(z.array(z.string())), undefined),
  pron: z.optional(
    z.object({
      ipa: z.optional(z.array(z.string())),
      audio: z.catch(
        z.optional(
          z.array(z.object({ url: z.string(), source: z.catch(z.optional(z.string()), undefined) })),
        ),
        undefined,
      ),
      reading: z.optional(z.string()),
    }),
  ),
  senses: z.array(
    z.object({
      glosses: z.array(z.string()).check(z.minLength(1)),
      see: z.optional(z.array(z.string())),
    }),
  ),
  /** Pages the entry is built from. Shown only on the origin of a metadata source. */
  sources: z.catch(z.optional(z.array(z.string())), undefined),
  /** The parts of the sent `context` this entry covers (`context-match`). */
  match: z.catch(z.optional(z.array(z.string()).check(z.minLength(1))), undefined),
})

const lookupSegmentSchema = z.object({
  text: z.string(),
  entries: z.optional(z.array(z.int().check(z.minimum(0)))),
})

export const lookupResultSchema = z.object({
  entries: z.array(lookupEntrySchema),
  // Optional in the protocol, so a malformed split must not cost the entries.
  segments: z.catch(z.optional(z.array(lookupSegmentSchema)), undefined),
})

/** Body of a `400` from `/v1/lookup`. */
export const lookupErrorSchema = z.object({
  error: z.enum(["bad_request", "unsupported_lang"]),
})

export type ServerMeta = z.infer<typeof serverMetaSchema>
export type ServerLegal = z.infer<typeof legalSchema>
export type ServerSource = z.infer<typeof sourceSchema>
export type LookupResult = z.infer<typeof lookupResultSchema>
export type LookupEntry = z.infer<typeof lookupEntrySchema>
export type LookupSegment = z.infer<typeof lookupSegmentSchema>

export const parseBody = <S extends z.ZodMiniType>(
  schema: S,
  data: unknown,
  label: string,
): Result<z.infer<S>, DictError> => {
  const result = schema.safeParse(data)
  if (!result.success) {
    return err(bodyError(label))
  }
  return ok(result.data)
}
