/** Word lookup on a page: the popover, the session it searches with, and the subtitles that open it. */
import { createKeeping } from "$lib/anki/keep"
import { sendShownLookup } from "$lib/messages"
import { getAnkiEnabled, getMarkStyle, getShowIpa, getTheme } from "$lib/storage"
import { isDark } from "$lib/theme"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { watchAltHold } from "./page/hold"
import { MAX_WORD_CHARS, selectedText, wordAt, type AnchorRect, type WordHit } from "./page/pick"
import { isDarkBehind } from "./page/scheme"
import { watchTouchSelection } from "./page/select"
import { sentenceAround, type Sentence } from "./page/sentence"
import { createPopoverHost } from "./popover/mount"
import { createSession } from "./session"
import type { Subtitles, SubtitlesOptions } from "./subtitles/controller"

export type LookupOptions = {
  /** Word lookup as a whole. Without it subtitles are the site's own. */
  isEnabled: () => boolean
  /** The popover's styles, for a page that does not load them into its shadow root itself. */
  css?: string
}

/**
 * Sets up lookup on the page, with holding Alt over a word or selecting it by touch to look it up. A press outside the
 * popover or Escape closes it, and a change to the servers or languages drops the answers kept so far.
 */
export const createLookup = (ctx: ContentScriptContext, { isEnabled, css }: LookupOptions) => {
  /** Covers the word the popover is open on, when it is the one under the cursor. */
  let shownRange: Range | undefined
  let subtitles: Subtitles | undefined
  const session = createSession()
  const popover = createPopoverHost(ctx, css)
  popover.onClose(() => {
    shownRange = undefined
  })

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
      const [theme, showIpa, markStyle, ankiEnabled] = await Promise.all([
        getTheme(),
        getShowIpa(),
        getMarkStyle(),
        getAnkiEnabled(),
      ])
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
        shown: sendShownLookup,
        paint: element === null ? undefined : subtitles?.markFor(element),
        keeping: ankiEnabled
          ? createKeeping(context === undefined ? undefined : { text: context.text, at: context.at })
          : undefined,
      }
    })
  }

  const subtitleOptions: SubtitlesOptions = {
    isEnabled,
    lookUp: ({ word, anchor, element, range }: WordHit, lang: string) =>
      // A track may not say its language.
      void open(
        word,
        anchor,
        element,
        range,
        sentenceAround(range, word, lang),
        lang.split("-")[0] || undefined,
      ),
    isShown: ({ range }: WordHit) =>
      popover.isOpen() &&
      shownRange?.startContainer === range.startContainer &&
      shownRange.startOffset === range.startOffset,
    close: popover.close,
  }

  ctx.addEventListener(
    window,
    "pointerdown",
    (event) => {
      // A click on another subtitle word replaces the popover rather than closing it, so the video stays paused.
      if (popover.isOpen() && !popover.contains(event) && subtitles?.contains(event) !== true) {
        subtitles?.keepClosingPress(event)
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
  watchAltHold(ctx, {
    isEnabled,
    wordAt: (x, y) => wordAt(x, y, session.locale()),
    isOverPopover: popover.isAt,
    popoverScroller: popover.scroller,
    show: ({ word, anchor, element, range }) =>
      void open(word, anchor, element, range, sentenceAround(range, word, session.locale())),
    close: popover.close,
  })
  watchTouchSelection(ctx, {
    isEnabled,
    isOnPopover: popover.contains,
    selected: () => selectedText(session.locale()),
    show: ({ word, element, context }, anchor) => void open(word, anchor, element, undefined, context),
  })
  browser.storage.onChanged.addListener((changes) => {
    // A server's sentence setting and the blocked sites decide what an answer was based on, the order which
    // language it came from.
    if (["servers", "serverByLang", "contextSites", "languageOrder"].some((key) => key in changes)) {
      session.clearReplies()
    }
  })

  return {
    open,
    session,
    /** What subtitles need to open lookups from their words. */
    subtitleOptions,
    /** Lets `shown` mark the looked-up word and play its video again once the popover closes. */
    useSubtitles: (shown: Subtitles) => {
      subtitles = shown
      popover.onClose(shown.popoverClosed)
    },
  }
}

export type Lookup = ReturnType<typeof createLookup>
