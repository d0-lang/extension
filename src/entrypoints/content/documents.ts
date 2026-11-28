import { ContentScriptContext } from "wxt/utils/content-script-context"

/**
 * Runs `start` once for each document the frame shows, with a context that is invalidated when the next one comes.
 * A page that writes a new document into a frame with `document.open()`, like a book reader into its `about:blank`
 * frames, wipes every listener on the old one and the window.
 */
export const onEachDocument = (ctx: ContentScriptContext, start: (ctx: ContentScriptContext) => void) => {
  let shown = document.documentElement
  let current: ContentScriptContext | undefined

  const startNew = () => {
    current?.abort()
    // A name of its own, so starting it does not stop `ctx` as a newer copy of the script would.
    current = new ContentScriptContext("content:document", {
      ...ctx.options,
      noScriptStartedPostMessage: true,
    })
    start(current)
  }
  startNew()

  // `document.open()` keeps the document, and the observers on it, but empties it.
  const observer = new MutationObserver(() => {
    if (document.documentElement !== null && document.documentElement !== shown) {
      shown = document.documentElement
      startNew()
    }
  })
  observer.observe(document, { childList: true })
  ctx.onInvalidated(() => {
    observer.disconnect()
    current?.abort()
  })
}
