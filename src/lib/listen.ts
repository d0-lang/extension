import type { ContentScriptContext } from "wxt/utils/content-script-context"

type BrowserEvent<Listener> = {
  addListener: (listener: Listener) => void
  removeListener: (listener: Listener) => void
}

/** Adds `listener` to a browser event, like `browser.storage.onChanged`, until `ctx` is invalidated. */
export const listenWhileValid = <Listener>(
  ctx: ContentScriptContext,
  event: BrowserEvent<Listener>,
  listener: Listener,
) => {
  event.addListener(listener)
  ctx.onInvalidated(() => event.removeListener(listener))
}
