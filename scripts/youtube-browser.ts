/** Opens real YouTube the way the YouTube scripts need it: in a browser YouTube takes for a viewer's, with or without the extension. */
import { chromium, type BrowserContext, type Page } from "playwright"

/** Where `buildExtension` leaves the extension. */
export const EXTENSION = new URL("../.output/chrome-mv3", import.meta.url).pathname

const AD_WAIT_MS = 90_000

/** Builds the extension into `EXTENSION`. Exits when the build fails. */
export const buildExtension = () => {
  const build = Bun.spawnSync(["bun", "run", "build"], { stdout: "ignore", stderr: "inherit" })
  if (build.exitCode !== 0) {
    process.exit(1)
  }
}

/** The browser's user agent without `HeadlessChrome`, which YouTube sends empty captions to. */
export const viewerUserAgent = async (): Promise<string> => {
  const probe = await chromium.launch({ channel: "chromium" })
  const major = probe.version().split(".")[0]
  await probe.close()
  return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`
}

type Session = {
  /** A fresh folder per session, because the player carries caption and translation choices from one video to the next. */
  profile: string
  userAgent: string
  /** The browser's language. In the video's own, YouTube neither dubs the audio nor translates the title. */
  locale: string
  /** The folder of a built extension to load, if any. */
  extension: string | undefined
  args?: Array<string>
}

export const openYouTube = async ({
  profile,
  userAgent,
  locale,
  extension,
  args = [],
}: Session): Promise<BrowserContext> => {
  const context = await chromium.launchPersistentContext(profile, {
    // The new headless mode, which loads extensions.
    channel: "chromium",
    headless: true,
    userAgent,
    locale,
    args: [
      // Like the user agent, `navigator.webdriver` gets empty captions.
      "--disable-blink-features=AutomationControlled",
      ...(extension === undefined
        ? []
        : [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]),
      ...args,
    ],
  })
  // Skips the EU consent page.
  await context.addCookies([{ name: "SOCS", value: "CAI", domain: ".youtube.com", path: "/" }])
  return context
}

/** Waits out ads, skipping them when YouTube offers it. */
export const waitForAds = async (page: Page) => {
  const deadline = Date.now() + AD_WAIT_MS
  while (Date.now() < deadline) {
    const showing = await page.evaluate(() =>
      document.querySelector("#movie_player")?.classList.contains("ad-showing"),
    )
    if (!showing) {
      return
    }
    await page
      .locator(".ytp-skip-ad-button, .ytp-ad-skip-button-modern")
      .click({ timeout: 1000 })
      .catch(() => {})
    await page.waitForTimeout(1000)
  }
  throw new Error("an ad was still showing")
}
