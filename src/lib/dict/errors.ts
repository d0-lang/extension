const handshakeMessage = {
  identity: "Server identity may have changed",
  broken: "Metadata signature does not match",
  failed: "Handshake failed",
} as const

export type SignatureError = {
  readonly kind: "signature"
  readonly message: string
}

export type HandshakeError = {
  readonly kind: "identity" | "broken" | "failed"
  readonly message: string
  readonly verificationUrls: Array<string>
  readonly newKey: string | undefined
}

export type DictError =
  | SignatureError
  | HandshakeError
  | {
      readonly kind:
        | "http"
        | "body"
        | "network"
        | "missing-signature"
        | "nonce"
        | "invalid-url"
        | "no-server"
        | "bad-request"
        | "unsupported-lang"
      readonly message: string
    }

export const signatureError = (): SignatureError => ({
  kind: "signature",
  message: "get-meta signature does not match",
})

export const handshakeError = (
  kind: HandshakeError["kind"],
  verificationUrls: Array<string> = [],
  newKey: string | undefined = undefined,
): HandshakeError => ({
  kind,
  message: handshakeMessage[kind],
  verificationUrls,
  newKey,
})

export const httpError = (operation: string, status: number): DictError => ({
  kind: "http",
  message: `${operation} failed: ${status}`,
})

export const bodyError = (label: string): DictError => ({
  kind: "body",
  message: `${label} returned an unexpected body`,
})

export const missingSignatureError = (): DictError => ({
  kind: "missing-signature",
  message: "get-meta missing X-Signature",
})

export const nonceError = (): DictError => ({
  kind: "nonce",
  message: "get-meta nonce does not match",
})

export const invalidUrlError = (): DictError => ({
  kind: "invalid-url",
  message: "Enter an http(s) URL without credentials, query or fragment",
})

export const fromUnknown = (cause: unknown): DictError => ({
  kind: "network",
  message: cause instanceof Error ? cause.message : String(cause),
})

export const noServerError = (): DictError => ({
  kind: "no-server",
  message: "No dictionary server is bound",
})

export const badRequestError = (): DictError => ({
  kind: "bad-request",
  message: "lookup rejected as a bad request",
})

export const unsupportedLangError = (): DictError => ({
  kind: "unsupported-lang",
  message: "lookup language is not supported",
})
