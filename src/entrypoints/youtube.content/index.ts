import { ORIGINAL_ATTRIBUTE } from "$lib/captions"
import { hookTimedtext } from "./hook"
import { keepOriginal } from "./original"
import { relayTimedtext } from "./relay"

export default defineContentScript({
  matches: ["*://www.youtube.com/*", "*://m.youtube.com/*", "*://www.youtube-nocookie.com/*"],
  // Players embedded in other sites are frames.
  allFrames: true,
  world: "MAIN",
  // Before the player loads, so its first request is seen.
  runAt: "document_start",
  main() {
    hookTimedtext(window, relayTimedtext(window))
    const check = keepOriginal(() => document.documentElement.hasAttribute(ORIGINAL_ATTRIBUTE))
    // The content script sets it once the page has loaded, when the video may already have its metadata.
    new MutationObserver(check).observe(document.documentElement, { attributeFilter: [ORIGINAL_ATTRIBUTE] })
  },
})
