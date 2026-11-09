import { isOpenLookupMessage, type OpenLookupMessage } from "$lib/messages"
import { getLookupEnabled, getShowIpa, getTheme } from "$lib/storage"
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

const NO_ANCHOR = { top: 8, bottom: 8, left: 8, right: 8 }

export default defineContentScript({
  matches: ["<all_urls>"],
  allFrames: true,
  cssInjectionMode: "ui",
  main(ctx) {
    let picked: Picked | undefined
    let enabled = false
    const session = createSession()
    const popover = createPopoverHost(ctx)

    const open = (
      word: string,
      anchor: AnchorRect,
      element: Element | null,
      underlined: boolean,
      context: Sentence | undefined,
    ) =>
      popover.show(async () => {
        const [theme, showIpa] = await Promise.all([getTheme(), getShowIpa()])
        return {
          word,
          anchor,
          dark: isDark(theme),
          showIpa,
          underline: underlined ? { rect: anchor, dark: isDarkBehind(element) } : undefined,
          marks:
            context === undefined
              ? undefined
              : { rectsOf: context.rectsOf, offsetIn: context.offsetIn, dark: isDarkBehind(element) },
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
                  ),
          follow: (target: string, language: string | undefined) => session.search(target, element, language),
        }
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
    ctx.addEventListener(
      window,
      "pointerdown",
      (event) => {
        if (popover.isOpen() && !popover.contains(event)) {
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
        pickedUnderCursor(picked, selectionText),
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
      // A server's sentence setting and the blocked sites decide what an answer was based on.
      if ("servers" in changes || "serverByLang" in changes || "contextSites" in changes) {
        session.clearReplies()
      }
    })

    watchAltHold(ctx, {
      isEnabled: () => enabled,
      wordAt: (x, y) => wordAt(x, y, session.locale()),
      isOverPopover: popover.isAt,
      popoverScroller: popover.scroller,
      show: ({ word, anchor, element, range }) =>
        void open(word, anchor, element, true, sentenceAround(range, word, session.locale())),
      close: popover.close,
    })
  },
})
