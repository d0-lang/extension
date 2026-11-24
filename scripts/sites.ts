/**
 * Checks the subtitles on other sites against real pages, with the built extension loaded.
 * Each page has a track on from the start, the way its player turns one on, and the check plays the video and expects
 * the extension's subtitles over it. `bun run sites` checks every page. Pass page names to check only those.
 */
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chromium } from "playwright"
import { buildExtension, EXTENSION, viewerUserAgent } from "./youtube-browser"

/** `own` is where the page's player draws its own subtitles, which are to hide while the extension's show. */
type Site = { name: string; url: string; own?: string }

const sites: Array<Site> = [
  // Vimeo turns a track on and plays from the address, and draws the track itself. A play from outside it while it
  // starts up, it pauses.
  {
    name: "vimeo",
    url: "https://player.vimeo.com/video/76979871?texttrack=en&autoplay=1&muted=1",
    own: ".vp-captions",
  },
  // MDN's captions demo: a plain video with a default track.
  { name: "mdn", url: "https://iandevlin.github.io/mdn/video-player-with-captions/" },
]

/** How long a page gets to show the extension's subtitles once its video plays, which takes in a first line a while in. */
const SHOW_MS = 20_000

const picked = process.argv.slice(2)
const checked = picked.length === 0 ? sites : sites.filter(({ name }) => picked.includes(name))

buildExtension()
const profile = mkdtempSync(join(tmpdir(), "dadict-sites-"))
const context = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  headless: true,
  userAgent: await viewerUserAgent(),
  args: [
    "--disable-blink-features=AutomationControlled",
    "--mute-audio",
    "--autoplay-policy=no-user-gesture-required",
    `--disable-extensions-except=${EXTENSION}`,
    `--load-extension=${EXTENSION}`,
  ],
})

let failed = false
for (const { name, url, own } of checked) {
  const page = await context.newPage()
  try {
    await page.goto(url, { waitUntil: "domcontentloaded" })
    await page.waitForSelector("video", { state: "attached" })
    await page.evaluate(() => {
      const video = document.querySelector("video")!
      video.muted = true
      if (video.paused && !location.search.includes("autoplay")) {
        void video.play().catch(() => {})
      }
    })
    const text = await page
      .waitForFunction(
        () => document.querySelector("[data-dadict-captions]:not([hidden])")?.textContent || undefined,
        undefined,
        { timeout: SHOW_MS },
      )
      .then((handle) => handle.jsonValue())
    const ownShows =
      own !== undefined &&
      (await page.evaluate(
        (selector) =>
          [...document.querySelectorAll(selector)].some(
            (element) => getComputedStyle(element).display !== "none",
          ),
        own,
      ))
    if (ownShows) {
      throw new Error(`the page's own subtitles, ${own}, still show`)
    }
    console.log(`ok    ${name}: ${JSON.stringify(text)}`)
  } catch (error) {
    failed = true
    console.log(`FAIL  ${name}: ${String(error).split("\n")[0]}`)
  }
  await page.close()
}

await context.close()
rmSync(profile, { recursive: true, force: true })
process.exit(failed ? 1 : 0)
