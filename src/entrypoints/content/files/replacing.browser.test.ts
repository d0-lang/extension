import { expect, it } from "vitest"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { REPLACING_ATTRIBUTE } from "$lib/subtitles/overlay"
import { markReplacing } from "./replacing"

const ctx = {
  setTimeout: (handler: () => void, ms: number) => window.setTimeout(handler, ms),
  onInvalidated: () => {},
} as unknown as ContentScriptContext

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

it("keeps the player marked through a moment without its file, and unmarks it after", async () => {
  const player = document.createElement("div")
  const mark = markReplacing(ctx)
  mark(player)
  await wait(300)
  mark(player)
  await wait(300)
  expect(player.hasAttribute(REPLACING_ATTRIBUTE)).toBe(true)
  await wait(300)
  expect(player.hasAttribute(REPLACING_ATTRIBUTE)).toBe(false)
})

it("moves the mark to another player", () => {
  const [first, second] = [document.createElement("div"), document.createElement("div")]
  const mark = markReplacing(ctx)
  mark(first)
  mark(second)
  expect(first.hasAttribute(REPLACING_ATTRIBUTE)).toBe(false)
  expect(second.hasAttribute(REPLACING_ATTRIBUTE)).toBe(true)
})
