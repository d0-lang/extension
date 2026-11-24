// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { keepPressFromPage } from "./press"

/** Longer than the press waits for its click after lifting. */
const AFTER_WAIT_MS = 1000

const fakeContext = (signal: AbortSignal) =>
  ({
    signal,
    setTimeout: (handler: () => void, ms: number) => window.setTimeout(handler, ms),
  }) as unknown as ContentScriptContext

describe("keepPressFromPage", () => {
  let controller: AbortController
  let player: HTMLElement
  let heard: Array<string>

  /** Sends `type` to the player, and to the guard first when it is a `pointerdown` that starts the kept press. */
  const press = (type: string, keep = false) => {
    const event = type.startsWith("pointer")
      ? new PointerEvent(type, { bubbles: true })
      : new Event(type, { bubbles: true })
    if (keep) {
      keepPressFromPage(fakeContext(controller.signal), event as PointerEvent)
    }
    player.dispatchEvent(event)
  }

  beforeEach(() => {
    vi.useFakeTimers()
    controller = new AbortController()
    player = document.createElement("div")
    document.body.append(player)
    heard = []
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      player.addEventListener(type, () => heard.push(type))
    }
  })

  afterEach(() => {
    controller.abort()
    player.remove()
    vi.useRealTimers()
  })

  it("keeps the whole press from the page, and the next one reaches it", () => {
    press("pointerdown", true)
    for (const type of ["mousedown", "pointerup", "mouseup", "click"]) {
      press(type)
    }
    expect(heard).toEqual([])
    press("click")
    expect(heard).toEqual(["click"])
  })

  it("lets a later click through when the press brings none", () => {
    press("pointerdown", true)
    press("pointerup")
    vi.advanceTimersByTime(AFTER_WAIT_MS)
    press("click")
    expect(heard).toEqual(["click"])
  })
})
