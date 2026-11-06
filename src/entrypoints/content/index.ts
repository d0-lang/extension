import { mount, unmount } from 'svelte';
import type { LookupContext } from '$lib/dict/api';
import { isOpenLookupMessage, requestLookup, type LookupReply, type OpenLookupMessage } from '$lib/messages';
import { getContextEnabled, getLookupEnabled, getShowIpa, getTheme } from '$lib/storage';
import { isDark } from '$lib/theme';
import { contextText, detectLanguages } from './context';
import { watchAltHold } from './hold';
import {
  MAX_WORD_CHARS,
  pickAt,
  pickedContext,
  pickedUnderCursor,
  pickedWord,
  wordAt,
  type AnchorRect,
  type Picked,
} from './pick';
import { isDarkBehind } from './scheme';
import { sentenceAround, type Sentence } from './sentence';
import Popover from './Popover.svelte';
import './popover.css';

const NO_ANCHOR = { top: 8, bottom: 8, left: 8, right: 8 };
const MAX_CACHED_REPLIES = 200;

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  cssInjectionMode: 'ui',
  main(ctx) {
    let picked: Picked | undefined;
    let current: { host: HTMLElement; shadow: ShadowRoot; remove: () => void } | undefined;
    // Building the UI is async, so a newer open or a close must cancel an older one.
    let latestOpen = 0;
    // Both last as long as this page does, so no list of visited sites gets stored.
    let pinned: string | undefined;
    let lastWorked: string | undefined;
    let enabled = false;
    let contextEnabled = false;
    const replies = new Map<string, LookupReply>();

    // `de_en` is read as German. Unset until a language has answered on this page.
    const pageLocale = (): string | undefined => (pinned ?? lastWorked)?.split('_')[0];

    const close = () => {
      latestOpen++;
      current?.remove();
      current = undefined;
    };

    const search = async (
      word: string,
      element: Element | null,
      language: string | undefined = pinned,
      context: LookupContext | undefined = undefined,
    ): Promise<LookupReply> => {
      const key = JSON.stringify([language, word, context]);
      const cached = replies.get(key);
      if (cached !== undefined) {
        return cached;
      }
      const reply = await requestLookup(word, {
        pinned: language,
        detected: language === undefined ? await detectLanguages(contextText(element)) : [],
        lastWorked,
      }, context);
      if (reply.ok && reply.lang !== undefined) {
        lastWorked = reply.lang;
      }
      // A failure may be temporary, so only answers are kept.
      if (reply.ok) {
        replies.set(key, reply);
        for (const oldest of replies.keys()) {
          if (replies.size <= MAX_CACHED_REPLIES) {
            break;
          }
          replies.delete(oldest);
        }
      }
      return reply;
    };

    const open = async (
      word: string,
      anchor: AnchorRect,
      element: Element | null,
      underlined: boolean,
      sentence: Sentence | undefined,
    ) => {
      close();
      const thisOpen = latestOpen;
      const context = contextEnabled ? sentence : undefined;
      const [theme, showIpa] = await Promise.all([getTheme(), getShowIpa()]);
      const props = {
        word,
        anchor,
        dark: isDark(theme),
        showIpa,
        underline: underlined ? { rect: anchor, dark: isDarkBehind(element) } : undefined,
        marks: context === undefined ? undefined : { rectsOf: context.rectsOf, dark: isDarkBehind(element) },
        search:
          word === '' || word.length > MAX_WORD_CHARS
            ? undefined
            : (language?: string, target: string = word) => {
                pinned = language ?? pinned;
                // The sentence is around `word`, not around a followed link.
                return search(
                  target,
                  element,
                  pinned,
                  target === word && context !== undefined ? { text: context.text, at: context.at } : undefined,
                );
              },
        follow: (target: string, language: string | undefined) => search(target, element, language),
      };
      const ui = await createShadowRootUi(ctx, {
        name: 'dict-lookup-popover',
        position: 'inline',
        // Not the body: a transform on it would break the popover's fixed position.
        anchor: document.documentElement,
        onMount: (target) => mount(Popover, { target, props }),
        onRemove: (app) => {
          if (app !== undefined) {
            void unmount(app);
          }
        },
      });
      if (thisOpen !== latestOpen) {
        return;
      }
      ui.mount();
      current = { host: ui.shadowHost, shadow: ui.shadow, remove: ui.remove };
    };

    ctx.addEventListener(
      window,
      'contextmenu',
      (event) => {
        picked = pickAt(
          event.clientX,
          event.clientY,
          event.target instanceof Element ? event.target : null,
          pageLocale(),
        );
      },
      { capture: true },
    );
    ctx.addEventListener(
      window,
      'pointerdown',
      (event) => {
        if (current !== undefined && !event.composedPath().includes(current.host)) {
          close();
        }
      },
      { capture: true },
    );
    ctx.addEventListener(
      window,
      'keydown',
      (event) => {
        if (event.key === 'Escape') {
          close();
        }
      },
      { capture: true },
    );

    const openPicked = ({ selectionText }: OpenLookupMessage) =>
      open(
        pickedWord(picked, selectionText),
        picked?.anchor ?? NO_ANCHOR,
        picked?.element ?? null,
        pickedUnderCursor(picked, selectionText),
        pickedContext(picked, pickedWord(picked, selectionText)),
      );

    browser.runtime.onMessage.addListener((message) => {
      if (isOpenLookupMessage(message)) {
        void openPicked(message);
      }
    });

    void getLookupEnabled().then((value) => {
      enabled = value;
    });
    const syncContextEnabled = () =>
      getContextEnabled(location.hostname).then((value) => {
        contextEnabled = value;
      });
    void syncContextEnabled();
    browser.storage.onChanged.addListener((changes) => {
      if ('lookupEnabled' in changes) {
        enabled = changes.lookupEnabled?.newValue === true;
      }
      if ('servers' in changes || 'serverByLang' in changes) {
        replies.clear();
      }
      if ('contextSites' in changes) {
        void syncContextEnabled();
      }
    });

    watchAltHold(ctx, {
      isEnabled: () => enabled,
      wordAt: (x, y) => wordAt(x, y, pageLocale()),
      isOverPopover: (x, y) =>
        current !== undefined && document.elementFromPoint(x, y) === current.host,
      popoverScroller: () => current?.shadow.querySelector('[data-popover-scroll]') ?? undefined,
      show: ({ word, anchor, element, range }) =>
        void open(word, anchor, element, true, contextEnabled ? sentenceAround(range, word, pageLocale()) : undefined),
      close,
    });
  },
});
