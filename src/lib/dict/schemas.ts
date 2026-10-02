import * as z from "zod/mini"

export const publicKeySchema = z.object({
  key: z.string().check(z.minLength(1)),
})

export const serverMetaSchema = z.object({
  name: z.string().check(z.minLength(1)),
  nonce: z.string(),
  languages: z._default(z.array(z.string()), []),
  verification_urls: z._default(z.array(z.string()), []),
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
): z.infer<S> => {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new Error(`${label} returned an unexpected body`)
  }
  return result.data
}
