import { afterEach, describe, expect, it } from "vitest"
import { wordAt, type WordHit } from "./pick"
import { textRects } from "./text"

const render = (html: string) => {
  document.body.innerHTML = html
}

/**
 * What `wordAt` finds with the cursor in the middle of the first box of `node`'s text.
 * Not the element's box, which takes in padding and `::before`.
 */
const hitOn = (node: Node, locale: string): WordHit | undefined => {
  const text = document.createRange()
  text.selectNodeContents(node)
  const rect = text.getClientRects()[0]!
  return wordAt((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2, locale)
}

const wordOn = (selector: string, locale: string): string | undefined =>
  hitOn(document.querySelector(selector)!, locale)?.word

/** The cursor on 勉, the first base character of the page's ruby. */
const hitOnRubyBase = (): WordHit | undefined => hitOn(document.querySelector("ruby")!.firstChild!, "ja")

afterEach(() => render(""))

describe("wordAt across elements", () => {
  it("keeps links apart that markup puts side by side without a space", () => {
    render(`<style>nav a { margin-right: 16px }</style>
      <nav lang="de"><a href="/">Startseite</a><a href="/hilfe" id="hilfe">Hilfe</a><a href="/konto">Konto</a></nav>`)
    expect(wordOn("#hilfe", "de")).toBe("Hilfe")
  })

  it("keeps tag chips apart", () => {
    render(`<style>.tag { display: inline-block; padding: 2px 8px; margin: 0 4px; border-radius: 99px; background: #eee }</style>
      <p lang="de"><span class="tag">Reise</span><span class="tag" id="kultur">Kultur</span><span class="tag">Essen</span></p>`)
    expect(wordOn("#kultur", "de")).toBe("Kultur")
  })

  it("keeps breadcrumbs apart whose separators are drawn by CSS", () => {
    render(`<style>.crumb + .crumb::before { content: "›"; padding: 0 6px }</style>
      <p lang="de"><span class="crumb">Startseite</span><span class="crumb" id="reise">Reise</span><span class="crumb">Japan</span></p>`)
    expect(wordOn("#reise", "de")).toBe("Reise")
  })

  it("joins a word cut into inline spans", () => {
    render(
      `<p lang="de">Heute habe ich <span style="color: red">W</span><span id="elt">elt</span><i>schmerz</i> gehabt.</p>`,
    )
    expect(wordOn("#elt", "de")).toBe("Weltschmerz")
  })

  it("joins letters that are inline blocks, like synced lyrics", () => {
    render(`<style>.letter { display: inline-block }</style>
      <p lang="de"><span class="letter">K</span><span class="letter">a</span><span class="letter" id="i">i</span><span class="letter">s</span><span class="letter">e</span><span class="letter">r</span> und Reich</p>`)
    expect(wordOn("#i", "de")).toBe("Kaiser")
  })

  it("joins a word across ruby, without the readings", () => {
    render(
      `<p lang="ja" style="font-size: 26px">私は毎日<ruby>勉<rt>べん</rt>強<rt>きょう</rt></ruby>しています。</p>`,
    )
    expect(hitOnRubyBase()?.word).toBe("勉強")
  })

  it("joins a word across ruby whose readings push the base text apart", () => {
    // Readings shown inline draw the base apart in Chromium too, as some browsers do for readings wider than the base.
    render(`<style>rt { display: inline; font-size: 13px }</style>
      <p lang="ja" style="font-size: 26px">私は毎日<ruby>勉<rt>べんべんべんべん</rt>強<rt>きょうきょうきょう</rt></ruby>しています。</p>`)
    expect(hitOnRubyBase()?.word).toBe("勉強")
  })
})

describe("wordAt anchor", () => {
  it("sits on the base text of a word with ruby, not on its reading", () => {
    render(
      `<p lang="ja" style="font-size: 26px">私は毎日<ruby>勉<rt>べん</rt>強<rt>きょう</rt></ruby>しています。</p>`,
    )
    const hit = hitOnRubyBase()!
    const textTop = Math.min(...textRects(hit.range).map(({ top }) => top))
    // Otherwise the test below proves nothing.
    expect(document.querySelector("rt")!.getBoundingClientRect().top).toBeLessThan(textTop)
    expect(hit.anchor.top).toBe(textTop)
  })
})
