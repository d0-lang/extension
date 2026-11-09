import { TIMEDTEXT_EVENT, timedtextDetail } from "$lib/captions"
import { hookTimedtext } from "./hook"

export default defineContentScript({
  matches: ["*://www.youtube.com/*", "*://m.youtube.com/*", "*://www.youtube-nocookie.com/*"],
  // Players embedded in other sites are frames.
  allFrames: true,
  world: "MAIN",
  // Before the player loads, so its first request is seen.
  runAt: "document_start",
  main() {
    hookTimedtext(window, (url, body) =>
      window.dispatchEvent(new CustomEvent(TIMEDTEXT_EVENT, { detail: timedtextDetail({ url, body }) })),
    )
  },
})
