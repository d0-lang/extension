/** Pages for checking the content script by hand, at `http://localhost:8787/pages/<name>`. */

type TestPage = { title: string; summary: string; body: string; script?: string }

const STYLE = `
:root{color-scheme:light dark;--bg:#fff;--fg:#111;--muted:#666;--card:#f6f6f7;--border:#e3e3e6;--accent:#4f46e5}
@media (prefers-color-scheme:dark){:root{--bg:#0b0b0c;--fg:#f2f2f3;--muted:#9a9aa2;--card:#161618;--border:#2a2a2e;--accent:#818cf8}}
body{margin:0;background:var(--bg);color:var(--fg);font:18px/1.6 system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:32px 20px 120px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:0 0 6px}
section{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-top:16px}
.expect{font-size:14px;color:var(--muted);border-left:3px solid var(--accent);padding-left:8px;margin:8px 0 0}
a{color:var(--accent)}
`

const pages: Record<string, TestPage> = {
  credits: {
    title: "Sources, labels and definitions",
    summary:
      "Words the credits and definitions servers answer with links, recordings, labels and long glosses.",
    body: `
<section lang="de">
  <h2>German</h2>
  <p>Die Mutter wohnt in einem kleinen Haus am See.</p>
  <p class="expect">With credits bound for de_en: Mutter plays its recording, and Sources lists its Wiktionary page and its Commons file page once each, without the tracker.example link of the second entry. Haus lists two Wiktionary pages and one recording. See and wohnt show no Sources button. With definitions bound for de_de instead, each sense is a whole sentence that wraps between words.</p>
</section>
<section lang="ru">
  <h2>Russian</h2>
  <p>Собака спит под столом, а я хочу написать письмо.</p>
  <p class="expect">собака shows noun, f and anim, and стол shows m and inan. Hovering or tabbing to f, m, anim or pf shows its name, and anim and pf their text too. inan has no explanation and takes no focus.</p>
</section>`,
  },
  moving: {
    title: "Text that moves",
    summary: "The underline stays on the word while the text moves without the page scrolling.",
    body: `
<section lang="de">
  <h2>Pushed down by a banner</h2>
  <div id="banner" style="height:0;overflow:hidden;background:var(--accent);color:#fff;transition:height .6s;border-radius:6px;padding:0 12px">Ein Banner, das kommt und geht.</div>
  <p>Hold Alt on <b>Weltschmerz</b> or <b>Zeitgeist</b> in this line while the banner opens and closes.</p>
  <p class="expect">The underline moves down and up with the word.</p>
</section>
<section lang="de">
  <h2>Inner scroll box</h2>
  <div id="inner" style="height:120px;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:4px 10px">
    ${Array.from({ length: 12 }, (_, index) => `<p>Zeile ${index + 1}: Das Haus im Reich des Kaisers und der Zeitgeist.</p>`).join("")}
  </div>
  <p class="expect">Right-click a word and look it up, then scroll the box with the wheel. The underline scrolls with the word and goes once the word leaves the box.</p>
</section>
<section lang="de">
  <h2>Drifting</h2>
  <p style="animation:drift 3s ease-in-out infinite alternate">Der Kaiser und das Reich treiben hin und her.</p>
  <p class="expect">The underline follows the word as it slides.</p>
</section>
<section lang="de">
  <h2>Replaced every 3 seconds</h2>
  <p id="replaced">Das Haus wird neu gezeichnet.</p>
  <p class="expect">Within 3 seconds of the lookup the underline goes, because its text is gone from the page. The popover stays.</p>
</section>`,
    script: `
const style = document.createElement("style")
style.textContent = "@keyframes drift{from{transform:translateX(0)}to{transform:translateX(120px)}}"
document.head.append(style)
const banner = document.getElementById("banner")
setInterval(() => { banner.style.height = banner.style.height === "48px" ? "0px" : "48px"; banner.style.lineHeight = "48px" }, 2000)
const replaced = document.getElementById("replaced")
setInterval(() => { replaced.innerHTML = replaced.textContent }, 3000)`,
  },
  split: {
    title: "Words cut into elements",
    summary: "Words split across inline elements are looked up whole, with the sentence as context.",
    body: `
<section lang="de">
  <h2>Inline spans</h2>
  <p>Heute habe ich <span style="color:#d33">W</span><span>elt</span><i>schmerz</i> und keinen Zeit<b>geist</b>.</p>
  <p class="expect">Weltschmerz and Zeitgeist come up whole from any letter, underlined as one word, with this sentence as context.</p>
</section>
<section lang="de">
  <h2>Bouncing letters (inline-block)</h2>
  <p class="bounce">${[..."Kaiser"].map((letter, index) => `<span style="animation-delay:${index * 0.12}s">${letter}</span>`).join("")} und ${[..."Reich"].map((letter, index) => `<span style="animation-delay:${index * 0.12}s">${letter}</span>`).join("")}</p>
  <p class="expect">Kaiser and Reich come up whole. One underline per word, following the letters' line.</p>
</section>
<section lang="de">
  <h2>Synced lyrics</h2>
  <div id="lyrics" style="font-size:22px">
    <p data-line>Im Haus des Kaisers singt der Zeitgeist</p>
    <p data-line>und Weltschmerz zieht durch das Reich</p>
  </div>
  <p class="expect">Letters light up and get bold one by one, which moves the ones after them. Words still come up whole, the context is the line, and the underline keeps up as the letters widen.</p>
</section>
<section lang="ja">
  <h2>Ruby</h2>
  <p style="font-size:26px">私は毎日<ruby>日本語<rt>にほんご</rt></ruby>を<ruby>勉<rt>べん</rt>強<rt>きょう</rt></ruby>しています。</p>
  <p class="expect">勉 or 強 looks up 勉強 without the readings, and with the mock ja_en server the sentence finds 勉強しています. The underline sits under the base text, not the reading.</p>
</section>
<section lang="de">
  <h2>Must stay apart</h2>
  <p>Haus<br>Reich</p>
  <div style="display:flex;gap:0"><span>Kaiser</span><span>Reich</span></div>
  <p>Zeit<span style="display:none">XX</span>geist</p>
  <p class="expect">Haus and Reich stay two words across the line break, and so do the flex items Kaiser and Reich. The last line reads Zeitgeist, without the hidden XX.</p>
</section>`,
    script: `
const style = document.createElement("style")
style.textContent = ".bounce span{display:inline-block;animation:bounce 1s ease-in-out infinite}@keyframes bounce{50%{transform:translateY(-6px)}}.sung{color:var(--accent);font-weight:700}"
document.head.append(style)
const letters = []
for (const line of document.querySelectorAll("[data-line]")) {
  const text = line.textContent
  line.textContent = ""
  for (const char of text) {
    const span = document.createElement("span")
    span.textContent = char
    line.append(span)
    letters.push(span)
  }
}
let at = 0
setInterval(() => {
  if (at === letters.length) { for (const letter of letters) letter.classList.remove("sung"); at = 0; return }
  letters[at++].classList.add("sung")
}, 120)`,
  },
}

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`)

export const testPageLinks = (): string =>
  Object.entries(pages)
    .map(
      ([name, page]) =>
        `<li><a href="/pages/${name}">${escapeHtml(page.title)}</a>: ${escapeHtml(page.summary)}</li>`,
    )
    .join("")

export const testPage = (name: string): Response => {
  const page = pages[name]
  if (page === undefined) {
    return new Response("unknown page", { status: 404 })
  }
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(page.title)}</title>
<style>${STYLE}</style>
<main><p><a href="/">All mock servers</a></p><h1>${escapeHtml(page.title)}</h1><p>${escapeHtml(page.summary)}</p>${page.body}</main>
<script>${page.script ?? ""}</script>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  )
}
