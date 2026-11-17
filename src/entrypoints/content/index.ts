import { isOpenLookupMessage, type OpenLookupMessage } from "$lib/messages"
import { getLookupEnabled, getMarkStyle, getShowIpa, getTheme } from "$lib/storage"
import { isDark } from "$lib/theme"
import { watchAltHold } from "./hold"
import { createPopoverHost } from "./mount"
import {
  MAX_WORD_CHARS,
  pickAt,
  pickedContext,
  pickedUnderCursor,
  pickedWord,
  wordAt,
  type AnchorRect,
  type Picked,
} from "./page/pick"
import { isDarkBehind } from "./page/scheme"
import { sentenceAround, type Sentence } from "./page/sentence"
import { createSession } from "./session"
import { showYouTubeCaptions } from "./youtube/captions"
import { isYouTube } from "./youtube/player"

const NO_ANCHOR = { top: 8, bottom: 8, left: 8, right: 8 }

export default defineContentScript({
  matches: ["<all_urls>"],
  allFrames: true,
  cssInjectionMode: "ui",
  main(ctx) {
    let picked: Picked | undefined
    /** Covers the word the popover is open on, when it is the one under the cursor. */
    let shownRange: Range | undefined
    let enabled = false
    const session = createSession()
    const popover = createPopoverHost(ctx)

    const open = (
      word: string,
      anchor: AnchorRect,
      element: Element | null,
      /** Covers `word` when it is the one under the cursor, to mark it on the page. */
      range: Range | undefined,
      context: Sentence | undefined,
      /** The language the text is known to be in, like a subtitle track's. */
      known?: string,
    ) => {
      shownRange = range
      return popover.show(async () => {
        const [theme, showIpa, markStyle] = await Promise.all([getTheme(), getShowIpa(), getMarkStyle()])
        return {
          word,
          anchor,
          dark: isDark(theme),
          showIpa,
          markStyle,
          highlight: range === undefined ? undefined : { range, dark: isDarkBehind(element) },
          marks:
            context === undefined
              ? undefined
              : { rangesOf: context.rangesOf, offsetIn: context.offsetIn, dark: isDarkBehind(element) },
          search:
            word === "" || word.length > MAX_WORD_CHARS
              ? undefined
              : (language?: string, target: string = word) =>
                  // The sentence is around `word`, not around a followed link.
                  session.search(
                    target,
                    element,
                    session.pin(language),
                    target === word && context !== undefined
                      ? { text: context.text, at: context.at }
                      : undefined,
                    known,
                  ),
          follow: (target: string, language: string | undefined) =>
            session.search(target, element, language, undefined, known),
          paint: element === null ? undefined : captions?.markFor(element),
        }
      })
    }
    popover.onClose(() => {
      shownRange = undefined
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
      ? showYouTubeCaptions(ctx, {
          isEnabled: () => enabled,
          lookUp: ({ word, anchor, element, range }, lang) =>
            void open(word, anchor, element, range, sentenceAround(range, word, lang), lang.split("-")[0]),
          isShown: ({ range }) =>
            popover.isOpen() &&
            shownRange?.startContainer === range.startContainer &&
            shownRange.startOffset === range.startOffset,
          close: popover.close,
        })
      : undefined
    if (captions !== undefined) {
      popover.onClose(captions.popoverClosed)
    }

    ctx.addEventListener(
      window,
      "pointerdown",
      (event) => {
        // A click on another subtitle word replaces the popover rather than closing it, so the video stays paused.
        if (popover.isOpen() && !popover.contains(event) && captions?.contains(event) !== true) {
          captions?.keepClosingPress(event)
          popover.close()
        }
      },
      { capture: true },
    )
    ctx.addEventListener(
      window,
      "keydown",
      (event) => {
        if (event.key === "Escape") {
          // Kept from the page, which would act on it too, like YouTube's player. Leaving fullscreen is up to the browser.
          if (popover.isOpen()) {
            event.stopPropagation()
            event.preventDefault()
          }
          popover.close()
        }
      },
      { capture: true },
    )

    const openPicked = ({ selectionText }: OpenLookupMessage) =>
      open(
        pickedWord(picked, selectionText),
        picked?.anchor ?? NO_ANCHOR,
        picked?.element ?? null,
        pickedUnderCursor(picked, selectionText) ? picked?.range : undefined,
        pickedContext(picked, pickedWord(picked, selectionText)),
      )

    browser.runtime.onMessage.addListener((message) => {
      if (isOpenLookupMessage(message)) {
        void openPicked(message)
      }
    })

    void getLookupEnabled().then((value) => {
      enabled = value
    })
    browser.storage.onChanged.addListener((changes) => {
      if ("lookupEnabled" in changes) {
        enabled = changes.lookupEnabled?.newValue === true
      }
      // A server's sentence setting and the blocked sites decide what an answer was based on, the order which
      // language it came from.
      if (["servers", "serverByLang", "contextSites", "languageOrder"].some((key) => key in changes)) {
        session.clearReplies()
      }
    })

    watchAltHold(ctx, {
      isEnabled: () => enabled,
      wordAt: (x, y) => wordAt(x, y, session.locale()),
      isOverPopover: popover.isAt,
      popoverScroller: popover.scroller,
      show: ({ word, anchor, element, range }) =>
        void open(word, anchor, element, range, sentenceAround(range, word, session.locale())),
      close: popover.close,
    })
  },
})
