/** The popover's shadow-root UI on the page. Only one is open at a time. */
import { mount, unmount, type ComponentProps } from "svelte"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import Popover from "./popover/Popover.svelte"
import "./popover/popover.css"

export type PopoverProps = ComponentProps<typeof Popover>

export const createPopoverHost = (ctx: ContentScriptContext) => {
  let current: { host: HTMLElement; shadow: ShadowRoot; remove: () => void } | undefined
  // Building the UI is async, so a newer open or a close must cancel an older one.
  let latestOpen = 0

  const close = () => {
    latestOpen++
    current?.remove()
    current = undefined
  }

  /** Close the open popover and show a new one. A later `show` or `close` cancels it while `props` is pending. */
  const show = async (props: () => Promise<PopoverProps>) => {
    close()
    const thisOpen = latestOpen
    const resolved = await props()
    const ui = await createShadowRootUi(ctx, {
      name: "dict-lookup-popover",
      position: "inline",
      // Not the body: a transform on it would break the popover's fixed position.
      anchor: document.documentElement,
      onMount: (target) => mount(Popover, { target, props: resolved }),
      onRemove: (app) => {
        if (app !== undefined) {
          void unmount(app)
        }
      },
    })
    if (thisOpen !== latestOpen) {
      return
    }
    ui.mount()
    current = { host: ui.shadowHost, shadow: ui.shadow, remove: ui.remove }
  }

  return {
    show,
    close,
    isOpen: (): boolean => current !== undefined,
    /** Whether `event` happened inside the popover. */
    contains: (event: Event): boolean => current !== undefined && event.composedPath().includes(current.host),
    isAt: (x: number, y: number): boolean =>
      current !== undefined && document.elementFromPoint(x, y) === current.host,
    scroller: (): HTMLElement | undefined =>
      current?.shadow.querySelector<HTMLElement>("[data-popover-scroll]") ?? undefined,
  }
}
