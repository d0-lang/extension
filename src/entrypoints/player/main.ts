import { mount } from "svelte"
import { ContentScriptContext } from "wxt/utils/content-script-context"
import { createLookup } from "$lib/lookup"
import { watchAltHold } from "$lib/page/hold"
import { wordAt } from "$lib/page/pick"
import { sentenceAround } from "$lib/page/sentence"
import "$lib/popover/marks.css"
import popoverCss from "$lib/popover/popover.css?inline"
import { syncTheme } from "$lib/theme"
import "../../styles/app.css"
import App from "./App.svelte"

await syncTheme()

// The subtitles and the popover are made for content scripts, so the page gives them a context of its own.
const ctx = new ContentScriptContext("player")
const lookup = createLookup(ctx, {
  isEnabled: () => true,
  // A content script's popover gets these through WXT, with `:root` made the shadow root's host.
  css: popoverCss.replaceAll(":root", ":host"),
})

watchAltHold(ctx, {
  isEnabled: () => true,
  wordAt: (x, y) => wordAt(x, y, lookup.session.locale()),
  isOverPopover: lookup.popover.isAt,
  popoverScroller: lookup.popover.scroller,
  show: ({ word, anchor, element, range }) =>
    void lookup.open(word, anchor, element, range, sentenceAround(range, word, lookup.session.locale())),
  close: lookup.popover.close,
})

const app = mount(App, {
  target: document.getElementById("app")!,
  props: { ctx, lookup },
})

export default app
