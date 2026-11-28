import { isOpenLookupMessage, type OpenLookupMessage } from "$lib/messages"
import { getLookupEnabled } from "$lib/storage"
import { listenWhileValid } from "$lib/listen"
import { createLookup } from "$lib/lookup"
import { pickAt, pickedContext, pickedUnderCursor, pickedWord, type Picked } from "$lib/page/pick"
import "$lib/popover/popover.css"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { onEachDocument } from "./documents"
import { showVideoSubtitles } from "./video/captions"
import { showYouTubeCaptions } from "./youtube/captions"
import { isYouTube } from "./youtube/player"

const NO_ANCHOR = { top: 8, bottom: 8, left: 8, right: 8 }

export default defineContentScript({
  matches: ["<all_urls>"],
  allFrames: true,
  // Readers like letonika.lv's write the book into `about:blank` frames.
  matchAboutBlank: true,
  cssInjectionMode: "ui",
  main(ctx) {
    onEachDocument(ctx, start)
  },
})

/** Sets up lookup on the frame's document. */
const start = (ctx: ContentScriptContext) => {
  let picked: Picked | undefined
  let enabled = false
  const { open, session, subtitleOptions, useSubtitles } = createLookup(ctx, {
    isEnabled: () => enabled,
  })

  ctx.addEventListener(
    window,
    "contextmenu",
    (event) => {
      picked = pickAt(
        event.clientX,
        event.clientY,
        event.target instanceof Element ? event.target : null,
        session.locale(),
      )
    },
    { capture: true },
  )
  const captions = isYouTube(location.hostname)
    ? showYouTubeCaptions(ctx, subtitleOptions)
    : showVideoSubtitles(ctx, subtitleOptions)
  if (captions !== undefined) {
    useSubtitles(captions)
  }

  const openPicked = ({ selectionText }: OpenLookupMessage) =>
    open(
      pickedWord(picked, selectionText),
      picked?.anchor ?? NO_ANCHOR,
      picked?.element ?? null,
      pickedUnderCursor(picked, selectionText) ? picked?.range : undefined,
      pickedContext(picked, pickedWord(picked, selectionText)),
    )

  listenWhileValid(ctx, browser.runtime.onMessage, (message: unknown) => {
    if (isOpenLookupMessage(message)) {
      void openPicked(message)
    }
  })

  void getLookupEnabled().then((value) => {
    enabled = value
  })
  listenWhileValid(ctx, browser.storage.onChanged, (changes) => {
    if ("lookupEnabled" in changes) {
      enabled = changes.lookupEnabled?.newValue === true
    }
  })
}
