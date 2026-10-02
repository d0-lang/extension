export class SignatureError extends Error {
  readonly kind = "signature" as const

  constructor() {
    super("get-meta signature does not match")
    this.name = "SignatureError"
  }
}

const handshakeMessage = {
  identity: "Server identity may have changed",
  broken: "Metadata signature does not match",
  failed: "Handshake failed",
} as const

export class HandshakeError extends Error {
  readonly kind: "identity" | "broken" | "failed"
  readonly verificationUrls: Array<string>
  readonly newKey: string | undefined

  constructor(
    kind: "identity" | "broken" | "failed",
    verificationUrls: Array<string> = [],
    newKey: string | undefined = undefined,
  ) {
    super(handshakeMessage[kind])
    this.name = "HandshakeError"
    this.kind = kind
    this.verificationUrls = verificationUrls
    this.newKey = newKey
  }
}
