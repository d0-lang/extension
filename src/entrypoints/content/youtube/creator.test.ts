import { describe, expect, it } from "vitest"
import { creatorCues } from "./creator"
import type { Json3 } from "./json3"

describe("creatorCues", () => {
  it("styles each speaker with their pen", () => {
    const json3: Json3 = {
      pens: [{}, { fcForeColor: 0xffff00 }, { iAttr: 1, bAttr: 1 }],
      events: [
        {
          tStartMs: 0,
          dDurationMs: 1000,
          segs: [{ utf8: "Pass the salt.", pPenId: 1 }, { utf8: "\n" }, { utf8: "Here you go.", pPenId: 2 }],
        },
      ],
    }
    expect(creatorCues(json3)).toEqual([
      {
        startMs: 0,
        endMs: 1000,
        text: "Pass the salt.\nHere you go.",
        styles: [
          { color: "#ffff00", from: 0, to: 14 },
          { italic: true, bold: true, from: 15, to: 27 },
        ],
      },
    ])
  })

  it("takes the event's pen where a piece names none, and leaves white unstyled", () => {
    const json3: Json3 = {
      pens: [{}, { fcForeColor: 0x00ffff }, { fcForeColor: 0xffffff }],
      events: [
        { tStartMs: 0, dDurationMs: 1000, pPenId: 1, segs: [{ utf8: "Ja " }, { utf8: "nie.", pPenId: 2 }] },
      ],
    }
    expect(creatorCues(json3)[0]).toMatchObject({
      text: "Ja nie.",
      styles: [{ color: "#00ffff", from: 0, to: 3 }],
    })
  })

  it("keeps styles on their words when sounds and padding go", () => {
    const json3: Json3 = {
      pens: [{}, { iAttr: 1 }],
      events: [
        { tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: " [Music]  Hi  " }, { utf8: "there", pPenId: 1 }] },
      ],
    }
    expect(creatorCues(json3)[0]).toMatchObject({
      text: "Hi there",
      styles: [{ italic: true, from: 3, to: 8 }],
    })
  })

  it("keeps the place of a cue only when it is not where the cues mostly are", () => {
    const json3: Json3 = {
      wpWinPositions: [
        {},
        { apPoint: 7, ahHorPos: 50, avVerPos: 90 },
        { apPoint: 4, ahHorPos: 50, avVerPos: 55 },
      ],
      events: [
        { tStartMs: 0, dDurationMs: 1000, wpWinPosId: 1, segs: [{ utf8: "Raz" }] },
        { tStartMs: 1000, dDurationMs: 1000, wpWinPosId: 2, segs: [{ utf8: "Dwa" }] },
        { tStartMs: 2000, dDurationMs: 1000, wpWinPosId: 1, segs: [{ utf8: "Trzy" }] },
      ],
    }
    expect(creatorCues(json3).map(({ place }) => place)).toEqual([
      undefined,
      { anchor: 4, x: 50, y: 55 },
      undefined,
    ])
  })
})
