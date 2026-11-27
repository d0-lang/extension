import { describe, expect, it } from "vitest"
import { readTtml, ttmlLanguage, ttmlTime } from "./ttml"

/** Cut down from an ARD file, which colours each speaker and puts a cue at the top when the bottom is taken. */
const ARD = `<?xml version="1.0" encoding="UTF-8"?>
<tt:tt xmlns:tt="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter"
  xmlns:tts="http://www.w3.org/ns/ttml#styling" ttp:timeBase="media" xml:lang="de-DE">
  <tt:head>
    <tt:styling>
      <tt:style xml:id="defaultStyle" tts:fontFamily="Verdana" tts:fontSize="160%" />
      <tt:style xml:id="textYellow" tts:color="#FFFF00" tts:backgroundColor="#000000c2" />
      <tt:style xml:id="textCyan" tts:color="#00FFFF" tts:backgroundColor="#000000c2" />
      <tt:style xml:id="textWhite" tts:color="#FFFFFF" tts:backgroundColor="#000000c2" />
      <tt:style xml:id="textCenter" tts:textAlign="center" />
    </tt:styling>
    <tt:layout>
      <tt:region xml:id="top" tts:origin="10% 10%" tts:extent="80% 80%" tts:displayAlign="before" />
      <tt:region xml:id="bottom" tts:origin="10% 10%" tts:extent="80% 80%" tts:displayAlign="after" />
    </tt:layout>
  </tt:head>
  <tt:body>
    <tt:div style="defaultStyle">
      <tt:p xml:id="sub0" style="textCenter" region="bottom" begin="00:00:05.080" end="00:00:06.200">
        <tt:span style="textCyan">Guten Abend!</tt:span>
      </tt:p>
      <tt:p xml:id="sub1" style="textCenter" region="bottom" begin="00:00:24.880" end="00:00:27.480">
        <tt:span style="textWhite">"Hast du mich</tt:span>
        <tt:br />
        <tt:span style="textWhite">verstanden?"</tt:span>
      </tt:p>
      <tt:p xml:id="sub2" style="textCenter" region="bottom" begin="00:00:27.480" end="00:00:28.100">
        <tt:span style="textYellow">- Ja.</tt:span>
      </tt:p>
      <tt:p xml:id="sub3" style="textCenter" region="top" begin="00:01:00.000" end="00:01:02.000">
        <tt:span style="textWhite">Hamburg, </tt:span><tt:span style="textYellow">heute</tt:span>
      </tt:p>
    </tt:div>
  </tt:body>
</tt:tt>`

const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml")

describe("readTtml", () => {
  it("reads cues with their speakers' colours, lines and the place of one that is not at the bottom", () => {
    expect(readTtml(parse(ARD))).toEqual([
      { startMs: 5080, endMs: 6200, text: "Guten Abend!", styles: [{ color: "#00ffff", from: 0, to: 12 }] },
      { startMs: 24_880, endMs: 27_480, text: '"Hast du mich\nverstanden?"' },
      { startMs: 27_480, endMs: 28_100, text: "- Ja.", styles: [{ color: "#ffff00", from: 0, to: 5 }] },
      {
        startMs: 60_000,
        endMs: 62_000,
        text: "Hamburg, heute",
        styles: [{ color: "#ffff00", from: 9, to: 14 }],
        place: { anchor: 1, x: 50, y: 10 },
      },
    ])
  })

  it("takes styles set on the element and its parents, and leaves out cues without a time", () => {
    const xml = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
      <body><div tts:fontStyle="italic">
        <p begin="1s" end="2.5s">Sotto <span tts:fontWeight="bold">voce</span></p>
        <p>No time</p>
      </div></body></tt>`
    expect(readTtml(parse(xml))).toEqual([
      {
        startMs: 1000,
        endMs: 2500,
        text: "Sotto voce",
        styles: [
          { italic: true, from: 0, to: 6 },
          { italic: true, bold: true, from: 6, to: 10 },
        ],
      },
    ])
  })
})

describe("ttmlTime", () => {
  it("reads clock times, frames and offsets", () => {
    expect(ttmlTime("01:02:03.5", 25)).toBe(3_723_500)
    expect(ttmlTime("00:00:01:12", 25)).toBe(1480)
    expect(ttmlTime("90ms", 25)).toBe(90)
    expect(ttmlTime("50f", 25)).toBe(2000)
    expect(ttmlTime("soon", 25)).toBeUndefined()
  })
})

describe("ttmlLanguage", () => {
  it("is the file's language without its region", () => {
    expect(ttmlLanguage(parse(ARD))).toBe("de")
  })
})
