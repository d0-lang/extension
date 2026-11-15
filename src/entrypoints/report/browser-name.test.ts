import { describe, expect, it } from "vitest"
import { browserLabel, pickBrand } from "./browser-name"

describe("pickBrand", () => {
  it("names the browser by its own brand, not Chromium or the made-up one", () => {
    expect(
      pickBrand([
        { brand: "Chromium", version: "142.0.7444.59" },
        { brand: "Google Chrome", version: "142.0.7444.59" },
        { brand: "Not_A Brand", version: "99.0.0.0" },
      ]),
    ).toEqual({ brand: "Google Chrome", version: "142.0.7444.59" })
  })

  it("falls back to Chromium", () => {
    expect(
      pickBrand([
        { brand: "Not)A;Brand", version: "8" },
        { brand: "Chromium", version: "142" },
      ]),
    ).toEqual({ brand: "Chromium", version: "142" })
  })
})

describe("browserLabel", () => {
  it("adds the OS", () => {
    expect(browserLabel({ name: "Firefox", version: "158.0" }, "linux")).toBe("Firefox 158.0 on Linux")
    expect(browserLabel({ name: "Google Chrome", version: "142" }, "mac")).toBe("Google Chrome 142 on macOS")
  })

  it("is unset without a browser", () => {
    expect(browserLabel(undefined, "win")).toBeUndefined()
  })
})
