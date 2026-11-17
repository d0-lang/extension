// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest"
import { sentenceAround } from "./sentence"
import { firstText, indexIn, rangeIn, runAround } from "./text"

// happy-dom leaves `display` empty unless a style sets it.
const STYLE = `<style>
  div, p { display: block } span, b, i, ruby { display: inline } rt { display: ruby-text }
  .letter { display: inline-block } .hidden { display: none }
</style>`

const render = (html: string) => {
  document.body.innerHTML = STYLE + html
}

/** The text node whose text is `text`. */
const textNode = (text: string): Text => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let next = walker.nextNode(); next !== null; next = walker.nextNode()) {
    if (next instanceof Text && next.data === text) {
      return next
    }
  }
  throw new Error(`no text node ${text}`)
}

beforeEach(() => render(""))

describe("runAround", () => {
  it("joins a word cut into inline spans", () => {
    render(`<p>Ich <span>W</span><span>e</span><b>lt</b>schmerz heute</p>`)
    expect(runAround(textNode("e"), 64).text).toBe("Ich Weltschmerz heute")
  })

  it("joins letters that are inline blocks, like synced lyrics", () => {
    render(`<p><span class="letter">h</span><span class="letter">a</span><span class="letter">u</span>s</p>`)
    expect(runAround(textNode("a"), 64).text).toBe("haus")
  })

  it("leaves out ruby readings", () => {
    render(`<p><ruby>勉<rt>べん</rt>強<rt>きょう</rt></ruby>しています</p>`)
    expect(runAround(textNode("勉"), 64).text).toBe("勉強しています")
  })

  it("leaves out hidden text", () => {
    render(`<p>Kai<span class="hidden">(skip)</span>ser</p>`)
    expect(runAround(textNode("Kai"), 64).text).toBe("Kaiser")
  })

  it("stops at a line break", () => {
    render(`<p>erste Zeile<br>zweite Zeile</p>`)
    expect(runAround(textNode("zweite Zeile"), 64).text).toBe("zweite Zeile")
    expect(runAround(textNode("erste Zeile"), 64).text).toBe("erste Zeile")
  })

  it("stops at a nested block on either side", () => {
    render(`<div>vor<div>innen</div>nach</div>`)
    expect(runAround(textNode("nach"), 64).text).toBe("nach")
    expect(runAround(textNode("vor"), 64).text).toBe("vor")
    expect(runAround(textNode("innen"), 64).text).toBe("innen")
  })

  it("does not join separate paragraphs", () => {
    render(`<p>eins</p><p>zwei</p>`)
    expect(runAround(textNode("zwei"), 64).text).toBe("zwei")
  })

  it("stops once it reaches far enough, not counting spaces", () => {
    render(`<p><span>aa</span><span>     </span><span>bb</span><span>cc</span><span>X</span></p>`)
    expect(runAround(textNode("X"), 4).text).toBe("bbccX")
  })
})

describe("indexIn and rangeIn", () => {
  it("map between run offsets and text nodes", () => {
    render(`<p>Ich <span>W</span><span>e</span><b>lt</b>schmerz</p>`)
    const run = runAround(textNode("e"), 64)
    expect(indexIn(run, textNode("e"), 0)).toBe(5)
    const range = rangeIn(run, 4, 15)!
    expect(range.toString()).toBe("Weltschmerz")
    expect(range.startContainer).toBe(textNode("W"))
    expect(range.endContainer).toBe(textNode("schmerz"))
  })

  it("places a boundary between elements on the text after it", () => {
    render(`<p>Ich <b>Welt</b></p>`)
    const run = runAround(textNode("Welt"), 64)
    const bold = document.querySelector("b")!
    expect(indexIn(run, bold, 0)).toBe(4)
    expect(indexIn(run, bold, 1)).toBe(8)
  })
})

describe("firstText", () => {
  it("skips a text node the range only touches at its end", () => {
    render(`<p>eins</p><p>zwei</p>`)
    const range = document.createRange()
    range.setStart(document.querySelectorAll("p")[1]!, 0)
    range.setEnd(textNode("zwei"), 4)
    expect(firstText(range)).toBe(textNode("zwei"))
  })
})

describe("sentenceAround", () => {
  it("reads the sentence across a word cut into spans", () => {
    render(`<p>Erster Satz. Ich habe <span>W</span><span>e</span>ltschmerz heute. Letzter Satz.</p>`)
    const run = runAround(textNode("e"), 64)
    const word = rangeIn(run, run.text.indexOf("Weltschmerz"), run.text.indexOf("Weltschmerz") + 11)!
    const sentence = sentenceAround(word, "Weltschmerz", "de")
    expect(sentence?.text).toBe("Ich habe Weltschmerz heute.")
    expect(sentence?.at).toBe(1)
    expect(sentence?.rangesOf(["Weltschmerz"]).map(String)).toEqual(["Weltschmerz"])
  })

  it("sends the clauses around the word of a sentence over 500 characters", () => {
    const long = "uno, ".repeat(110)
    render(`<p>Antes. ${long}así como un plan, ${long}fin. Después.</p>`)
    const run = runAround(textNode(`Antes. ${long}así como un plan, ${long}fin. Después.`), 600)
    const at = run.text.indexOf("como")
    const sentence = sentenceAround(rangeIn(run, at, at + 4)!, "como", "es")
    expect(sentence?.text.length).toBeLessThanOrEqual(500)
    expect(sentence?.text).toContain("así como un plan,")
    expect(sentence?.text.startsWith("uno,")).toBe(true)
    expect(sentence?.at).toBe(1)
    expect(sentence?.rangesOf(["así como"]).map(String)).toEqual(["así como"])
  })

  it("reads on past a line break in the markup", () => {
    render(`<p>Erster Satz. Ich habe\n      Weltschmerz heute. Letzter Satz.</p>`)
    const run = runAround(textNode("Erster Satz. Ich habe\n      Weltschmerz heute. Letzter Satz."), 64)
    const word = rangeIn(run, run.text.indexOf("Weltschmerz"), run.text.indexOf("Weltschmerz") + 11)!
    expect(sentenceAround(word, "Weltschmerz", "de")?.text).toBe("Ich habe Weltschmerz heute.")
  })

  it("reads a sentence with ruby, without the readings", () => {
    render(`<p>私は<ruby>勉<rt>べん</rt>強<rt>きょう</rt></ruby>しています。</p>`)
    const run = runAround(textNode("勉"), 64)
    const word = rangeIn(run, 2, 4)!
    expect(sentenceAround(word, "勉強", "ja")?.text).toBe("私は勉強しています。")
  })
})
