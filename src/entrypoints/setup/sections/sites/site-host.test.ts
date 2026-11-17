import { describe, expect, it } from "vitest"
import { siteHost } from "./site-host"

describe("siteHost", () => {
  it("takes the host of a typed site or a pasted link", () => {
    expect(siteHost("mail.google.com")).toBe("mail.google.com")
    expect(siteHost("https://docs.google.com/document/d/1")).toBe("docs.google.com")
  })

  it("drops a leading www. and the case", () => {
    expect(siteHost(" WWW.Example.org ")).toBe("example.org")
  })

  it("is unset for a bare word, but keeps localhost", () => {
    expect(siteHost("gmail")).toBeUndefined()
    expect(siteHost("localhost")).toBe("localhost")
  })
})
