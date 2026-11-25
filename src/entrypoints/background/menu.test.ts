import { afterEach, describe, expect, it, vi } from "vitest"
import { createMenuItem, listenToMenu, showMenuItem } from "./menu"

vi.mock("$lib/storage", () => ({ getLookupEnabled: async () => true }))

describe("the menu item", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("is left out where the browser has no right-click menu, like Firefox for Android", async () => {
    vi.stubGlobal("browser", { contextMenus: undefined })
    await expect(createMenuItem()).resolves.toBeUndefined()
    expect(() => showMenuItem(false)).not.toThrow()
    expect(() => listenToMenu()).not.toThrow()
  })
})
