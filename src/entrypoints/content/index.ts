import { mount, unmount } from 'svelte';
import { isOpenLookupMessage, requestLookup, type LookupReply, type OpenLookupMessage } from '$lib/messages';
import { contextText, detectLanguages } from './context';
import { MAX_WORD_CHARS, pickAt, pickedWord, type Picked } from './pick';
import Popover from './Popover.svelte';
import './popover.css';

const NO_ANCHOR = { top: 8, bottom: 8, left: 8, right: 8 };

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  cssInjectionMode: 'ui',
  main(ctx) {
    let picked: Picked | undefined;
    let current: { host: HTMLElement; remove: () => void } | undefined;
    // Building the UI is async, so a newer open or a close must cancel an older one.
    let latestOpen = 0;
    // Both last as long as this page does, so no list of visited sites gets stored.
    let pinned: string | undefined;
    let lastWorked: string | undefined;

    const close = () => {
      latestOpen++;
      current?.remove();
      current = undefined;
    };

    const search = async (word: string, element: Element | null): Promise<LookupReply> => {
      const reply = await requestLookup(word, {
        pinned,
        detected: pinned === undefined ? await detectLanguages(contextText(element)) : [],
        lastWorked,
      });
      if (reply.ok && reply.lang !== undefined) {
        lastWorked = reply.lang;
      }
      return reply;
    };

    const open = async ({ selectionText }: OpenLookupMessage) => {
      close();
      const thisOpen = latestOpen;
      const word = pickedWord(picked, selectionText);
      const element = picked?.element ?? null;
      const props = {
        word,
        anchor: picked?.anchor ?? NO_ANCHOR,
        dark: window.matchMedia('(prefers-color-scheme: dark)').matches,
        search:
          word === '' || word.length > MAX_WORD_CHARS
            ? undefined
            : (language?: string) => {
                pinned = language ?? pinned;
                return search(word, element);
              },
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
      current = { host: ui.shadowHost, remove: ui.remove };
    };

    ctx.addEventListener(
      window,
      'contextmenu',
      (event) => {
        picked = pickAt(
          event.clientX,
          event.clientY,
          event.target instanceof Element ? event.target : null,
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

    browser.runtime.onMessage.addListener((message) => {
      if (isOpenLookupMessage(message)) {
        void open(message);
      }
    });
  },
});
