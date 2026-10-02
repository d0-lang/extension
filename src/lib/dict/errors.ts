export class SignatureError extends Error {
  readonly kind = "signature" as const

  constructor() {
    super("get-meta signature does not match")
    this.name = "SignatureError"
  }
}

export class HandshakeError extends Error {
  readonly kind: "identity" | "failed"
  readonly verificationUrls: Array<string>
  readonly newKey: string | undefined

  constructor(
    kind: "identity" | "failed",
    verificationUrls: Array<string> = [],
    newKey: string | undefined = undefined,
  ) {
    super(kind === "identity" ? "Server identity may have changed" : "Handshake failed")
    this.name = "HandshakeError"
    this.kind = kind
    this.verificationUrls = verificationUrls
    this.newKey = newKey
  }
}
