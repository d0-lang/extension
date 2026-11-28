import { describe, expect, it } from "vitest"
import { senderHost } from "./lookup"

describe("senderHost", () => {
  it("is the frame's own host", () => {
    expect(senderHost({ url: "https://www.example.com/page", origin: "https://www.example.com" })).toBe(
      "www.example.com",
    )
  })

  it("is the origin's host for an about:blank frame", () => {
    expect(senderHost({ url: "about:blank", origin: "https://letonika.lv" })).toBe("letonika.lv")
  })

  it("is unset for a frame with an opaque origin and no host", () => {
    expect(senderHost({ url: "about:blank", origin: "null" })).toBeUndefined()
    expect(senderHost({ url: "about:srcdoc" })).toBeUndefined()
    expect(senderHost({})).toBeUndefined()
  })
})
