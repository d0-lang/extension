import { err, ok, type Result } from "neverthrow"
import * as z from "zod/mini"
import { isEd25519Key } from "./crypto"
import { bodyError, type DictError } from "./errors"
import { isHttpUrl } from "./url"

const httpUrlSchema = z.string().check(z.refine(isHttpUrl))

// These codes become object keys in storage, so a code like `__proto__` must not pass.
const languagePairSchema = z.string().check(z.regex(/^[a-z]+_[a-z]+$/))

export const publicKeySchema = z.object({
  key: z.string().check(z.refine(isEd25519Key)),
})

export const serverMetaSchema = z.object({
  name: z.string().check(z.minLength(1)),
  nonce: z.string(),
  languages: z._default(z.array(languagePairSchema), []),
  verification_urls: z._default(z.array(httpUrlSchema), []),
})

/** Domain-move body instead of metadata. Same signature/nonce rules; same signing key. */
export const newSourceSchema = z.object({
  nonce: z.string(),
  new_source: z.string().check(z.minLength(1)),
})

export const lookupResultSchema = z.object({
  word: z.string(),
  translation: z.string(),
})

export type ServerMeta = z.infer<typeof serverMetaSchema>
export type LookupResult = z.infer<typeof lookupResultSchema>

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
