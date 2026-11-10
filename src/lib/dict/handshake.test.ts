import { afterEach, describe, expect, it, vi } from "vitest"
import type { BoundServer } from "../storage"
import { handshake } from "./handshake"

const stored = vi.hoisted(() => ({ servers: {} as Record<string, unknown> }))
vi.mock("../storage", () => ({
  getStoredServer: (url: string) => Promise.resolve(stored.servers[url]),
}))

const OLD = "https://old.example.org"
const NEW = "https://new.example.org"
const NEWS = ["https://old.example.org/news"]

type KeyPair = { privateKey: CryptoKey; publicKey: string }

const base64 = (bytes: ArrayBuffer): string => btoa(String.fromCharCode(...new Uint8Array(bytes)))

const keyPair = async (): Promise<KeyPair> => {
  const pair = (await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"])) as CryptoKeyPair
  return {
    privateKey: pair.privateKey,
    publicKey: base64(await crypto.subtle.exportKey("raw", pair.publicKey)),
  }
}

/** What one address serves. Without `advertised`, `/v1/get-key` is a 404. */
type Host = { advertised?: KeyPair; signsWith: KeyPair; movedTo?: string }

/** Stands in for `fetch`, answering for `hosts` and keeping the paths asked for. */
const serve = (hosts: Record<string, Host>): Array<string> => {
  const asked: Array<string> = []
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const url = new URL(input)
    const host = hosts[url.origin]
    asked.push(`${url.origin}${url.pathname}`)
    if (host === undefined) {
      throw new TypeError("no such host")
    }
    if (url.pathname === "/v1/get-key") {
      return host.advertised === undefined
        ? new Response("not found", { status: 404 })
        : Response.json({ key: host.advertised.publicKey })
    }
    const nonce = new Headers(init?.headers).get("X-Nonce")
    const body = new TextEncoder().encode(
      JSON.stringify(
        host.movedTo === undefined
          ? { name: "Test", nonce, languages: ["de_en"], verification_urls: [] }
          : { nonce, new_source: host.movedTo },
      ),
    )
    const signature = base64(await crypto.subtle.sign("Ed25519", host.signsWith.privateKey, body))
    return new Response(body, { headers: { "X-Signature": signature } })
  })
  return asked
}

const bind = (url: string, key: KeyPair) => {
  stored.servers[url] = { url, key: key.publicKey, verificationUrls: NEWS } as Partial<BoundServer>
}

afterEach(() => {
  stored.servers = {}
  vi.unstubAllGlobals()
})

describe("handshake", () => {
  it("trusts the key the server serves on the first bind", async () => {
    const key = await keyPair()
    const asked = serve({ [OLD]: { advertised: key, signsWith: key } })
    const result = await handshake(OLD)
    expect(result._unsafeUnwrap()).toMatchObject({ url: OLD, key: key.publicKey, movedFrom: undefined })
    expect(asked).toEqual([`${OLD}/v1/get-key`, `${OLD}/v1/get-meta`])
  })

  it("verifies a bound server with the stored key, without asking for the key", async () => {
    const key = await keyPair()
    bind(OLD, key)
    const asked = serve({ [OLD]: { advertised: key, signsWith: key } })
    const result = await handshake(OLD)
    expect(result._unsafeUnwrap().key).toBe(key.publicKey)
    expect(asked).toEqual([`${OLD}/v1/get-meta`])
  })

  it("accepts metadata the stored key verifies, whatever key the server now advertises", async () => {
    const [key, next] = await Promise.all([keyPair(), keyPair()])
    bind(OLD, key)
    serve({ [OLD]: { advertised: next, signsWith: key } })
    expect((await handshake(OLD))._unsafeUnwrap().key).toBe(key.publicKey)
  })

  it("follows a move from an address that no longer serves its key", async () => {
    const key = await keyPair()
    bind(OLD, key)
    serve({ [OLD]: { signsWith: key, movedTo: NEW }, [NEW]: { advertised: key, signsWith: key } })
    const result = await handshake(OLD)
    expect(result._unsafeUnwrap()).toMatchObject({ url: NEW, key: key.publicKey, movedFrom: OLD })
  })

  it("reports an identity change when the signature fails and the server serves another key", async () => {
    const [key, next] = await Promise.all([keyPair(), keyPair()])
    bind(OLD, key)
    const asked = serve({ [OLD]: { advertised: next, signsWith: next } })
    const result = await handshake(OLD)
    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: "identity",
      verificationUrls: NEWS,
      newKey: next.publicKey,
    })
    expect(asked).toEqual([`${OLD}/v1/get-meta`, `${OLD}/v1/get-key`])
  })

  it("reports a broken response when the signature fails and the key is the same", async () => {
    const [key, other] = await Promise.all([keyPair(), keyPair()])
    bind(OLD, key)
    serve({ [OLD]: { advertised: key, signsWith: other } })
    expect((await handshake(OLD))._unsafeUnwrapErr()).toMatchObject({
      kind: "broken",
      verificationUrls: NEWS,
    })
  })

  it("reports a broken response when the signature fails and no key is served", async () => {
    const [key, other] = await Promise.all([keyPair(), keyPair()])
    bind(OLD, key)
    serve({ [OLD]: { signsWith: other } })
    expect((await handshake(OLD))._unsafeUnwrapErr().kind).toBe("broken")
  })

  it("takes metadata an accepted new key verifies", async () => {
    const [key, next] = await Promise.all([keyPair(), keyPair()])
    bind(OLD, key)
    const asked = serve({ [OLD]: { advertised: next, signsWith: next } })
    expect((await handshake(OLD, next.publicKey))._unsafeUnwrap().key).toBe(next.publicKey)
    expect(asked).toEqual([`${OLD}/v1/get-meta`])
  })

  it("reports a broken response when an accepted new key does not verify", async () => {
    const [key, next] = await Promise.all([keyPair(), keyPair()])
    bind(OLD, key)
    serve({ [OLD]: { advertised: next, signsWith: key } })
    expect((await handshake(OLD, next.publicKey))._unsafeUnwrapErr().kind).toBe("broken")
  })

  it("passes on a failure that is not about the signature", async () => {
    const key = await keyPair()
    bind(OLD, key)
    serve({})
    expect((await handshake(OLD))._unsafeUnwrapErr().kind).toBe("network")
  })
})
