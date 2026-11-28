/** The popover's shadow-root UI on the page. Only one is open at a time. */
import { mount, unmount, type ComponentProps } from "svelte"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import Popover from "./Popover.svelte"

export type PopoverProps = ComponentProps<typeof Popover>

/** Kept from a fullscreen player the popover is in, which would take them as play, pause or leaving fullscreen. */
const SWALLOWED = [
  "pointerdown",
  "pointerup",
  "mousedown",
  "mouseup",
  "click",
  "dblclick",
  "touchstart",
  "touchend",
]

/**
 * Where the popover goes: in the element that is fullscreen, like a player, since nothing outside it shows. Else the
 * root, not the body: a transform on it would break the popover's fixed position.
 */
const anchorNow = (): Element => {
  const full = document.fullscreenElement
  return full === null || full instanceof HTMLMediaElement ? document.documentElement : full
}

/**
 * The popover's place on the page. `css` is its styles, for a page that does not load them into its shadow root
 * itself, like a content script's `ui` injection does.
 */
export const createPopoverHost = (ctx: ContentScriptContext, css?: string) => {
  let current: { host: HTMLElement; shadow: ShadowRoot; remove: () => void } | undefined
  // Building the UI is async, so a newer open or a close must cancel an older one.
  let latestOpen = 0
  const closeListeners = new Set<() => void>()

  const remove = () => {
    latestOpen++
    current?.remove()
    current = undefined
  }

  const close = () => {
    remove()
    for (const listener of closeListeners) {
      listener()
    }
  }

  // It stays in the element it opened in, which would hide it behind the new fullscreen element or keep it in the old.
  ctx.addEventListener(document, "fullscreenchange", () => {
    if (current !== undefined) {
      close()
    }
  })

  /** Replace the open popover with a new one. A later `show` or `close` cancels it while `props` is pending. */
  const show = async (props: () => Promise<PopoverProps>) => {
    remove()
    const thisOpen = latestOpen
    const resolved = await props()
    const anchor = anchorNow()
    const ui = await createShadowRootUi(ctx, {
      name: "dict-lookup-popover",
      position: "inline",
      css,
      anchor,
      onMount: (target) => mount(Popover, { target, props: resolved }),
      onRemove: (app) => {
        if (app !== undefined) {
          void unmount(app)
        }
      },
    })
    // A context invalidated while this was pending, like by a frame's new document, no longer removes what it mounts.
    if (thisOpen !== latestOpen || ctx.isInvalid) {
      return
    }
    ui.mount()
    if (anchor !== document.documentElement) {
      for (const type of SWALLOWED) {
        ui.shadowHost.addEventListener(type, (event) => event.stopPropagation())
      }
    }
    current = { host: ui.shadowHost, shadow: ui.shadow, remove: ui.remove }
  }

  return {
    show,
    close,
    isOpen: (): boolean => current !== undefined,
    /** Calls `listener` on each close, though not when a new popover replaces the open one. */
    onClose: (listener: () => void) => {
      closeListeners.add(listener)
    },
    /** Whether `event` happened inside the popover. */
    contains: (event: Event): boolean => current !== undefined && event.composedPath().includes(current.host),
    isAt: (x: number, y: number): boolean =>
      current !== undefined && document.elementFromPoint(x, y) === current.host,
    scroller: (): HTMLElement | undefined =>
      current?.shadow.querySelector<HTMLElement>("[data-popover-scroll]") ?? undefined,
  }
}
