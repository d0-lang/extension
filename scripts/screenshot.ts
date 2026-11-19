/**
 * Takes the README's screenshots: a lookup of "Kraft" in a German sentence, in light and
 * dark, answered by a live server. Build first (`bun run build`), then:
 *
 *   bun scripts/screenshot.ts [server]   # default https://server.dadict.com
 *
 * Writes docs/screenshot-light.png and docs/screenshot-dark.png.
 */
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chromium, type Worker } from "playwright"

const EXTENSION = new URL("../.output/chrome-mv3", import.meta.url).pathname
const DOCS = new URL("../docs/", import.meta.url).pathname
const SERVER = (process.argv[2] ?? "https://server.dadict.com").replace(/\/+$/, "")
const WORD = "Kraft"

const PAGE = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Neues Gesetz</title>
<style>
  :root { color-scheme: light dark; --bg: #fafaf8; --fg: #1d1d1f; --muted: #6b6b70 }
  @media (prefers-color-scheme: dark) { :root { --bg: #141416; --fg: #ececee; --muted: #9a9aa2 } }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 21px/1.65 Georgia, "Times New Roman", serif }
  article { max-width: 680px; margin: 0 auto; padding: 44px 32px }
  h1 { font: 700 30px/1.25 system-ui, sans-serif; margin: 0 0 6px }
  .meta { font: 14px system-ui, sans-serif; color: var(--muted); margin: 0 0 20px }
</style></head>
<body><article>
  <h1>Neues Gesetz zum Klimaschutz</h1>
  <p class="meta">Berlin, 19. November</p>
  <p>Das Gesetz tritt morgen in Kraft. Die Regierung hatte es im Frühjahr vorgeschlagen, und der Bundestag stimmte ihm in der vergangenen Woche mit großer Mehrheit zu.</p>
</article></body></html>`

const pages = Bun.serve({
  port: 0,
  fetch: () => new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } }),
})
const pageUrl = `http://127.0.0.1:${pages.port}/`

// What the extension stores when the user adds the server and accepts its policies.
const { key } = (await (await fetch(`${SERVER}/v1/get-key`)).json()) as { key: string }
const meta = (await (
  await fetch(`${SERVER}/v1/get-meta`, { headers: { "x-nonce": "screenshot" } })
).json()) as {
  name: string
  languages: Array<string>
  features?: Array<string>
  verification_urls?: Array<string>
  report_url?: string
  sources?: Array<{
    name: string
    url: string
    license?: string
    license_url?: string
    languages?: Array<string>
  }>
  legal?: { privacy_link: string; privacy_hash: string; tos_link: string; tos_hash: string }
}
const server = {
  url: SERVER,
  key,
  name: meta.name,
  languages: meta.languages,
  verificationUrls: meta.verification_urls ?? [],
  features: meta.features ?? [],
  context: "all",
  legal:
    meta.legal === undefined
      ? null
      : {
          privacyLink: meta.legal.privacy_link,
          privacyHash: meta.legal.privacy_hash,
          tosLink: meta.legal.tos_link,
          tosHash: meta.legal.tos_hash,
        },
  sources: (meta.sources ?? []).map(({ license_url, ...rest }) => ({ ...rest, licenseUrl: license_url })),
  ...(meta.report_url === undefined ? {} : { reportUrl: meta.report_url }),
}

for (const scheme of ["light", "dark"] as const) {
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "dadict-shot-")), {
    channel: "chromium",
    headless: true,
    colorScheme: scheme,
    viewport: { width: 860, height: 560 },
    deviceScaleFactor: 2,
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  })
  const worker: Worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"))
  await worker.evaluate(
    async ({ server }) => {
      // @ts-ignore `chrome` exists in the extension's worker
      await chrome.storage.local.set({
        servers: { [server.url]: server },
        serverByLang: Object.fromEntries(server.languages.map((pair: string) => [pair, server.url])),
      })
    },
    { server },
  )
  for (const open of context.pages()) await open.close()

  const page = await context.newPage()
  await page.goto(pageUrl)
  // The middle of the last "Kraft" on the page, the one in "in Kraft".
  const box = await page.evaluate((word) => {
    const text = [...document.querySelectorAll("p")].find((p) => p.textContent!.includes(`in ${word}`))!
      .firstChild as Text
    const start = text.data.indexOf(`in ${word}`) + 3
    const range = document.createRange()
    range.setStart(text, start)
    range.setEnd(text, start + word.length)
    const rect = range.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  }, WORD)
  await page.mouse.click(box.x, box.y, { button: "right" })
  await page.keyboard.press("Escape")
  const tabId = await worker.evaluate(async (url) => {
    // @ts-ignore
    const [tab] = await chrome.tabs.query({ url })
    // @ts-ignore
    await chrome.tabs.sendMessage(tab.id, { type: "lookup:open", selectionText: undefined }, { frameId: 0 })
    return tab.id as number
  }, pageUrl)
  await page.waitForFunction(
    () =>
      (document.querySelector("dict-lookup-popover")?.shadowRoot?.textContent ?? "").includes(
        "in Kraft treten",
      ),
    undefined,
    { timeout: 15_000 },
  )
  // Let the popover finish appearing.
  await page.waitForTimeout(800)
  const file = `${DOCS}screenshot-${scheme}.png`
  // Down to just below the popover, which the window is tall enough to show whole.
  const bottom = await page.evaluate(() => {
    const root = document.querySelector("dict-lookup-popover")!.shadowRoot!
    return Math.max(...[...root.querySelectorAll("*")].map((node) => node.getBoundingClientRect().bottom))
  })
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 860, height: Math.ceil(bottom) + 36 } })
  console.log(`${file} (tab ${tabId})`)
  await context.close()
}
pages.stop()
