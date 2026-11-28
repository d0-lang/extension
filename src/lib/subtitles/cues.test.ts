import { describe, expect, it } from "vitest"
import { cueAt, inOrder, isFast, shownAt, type Cue } from "./cues"

const cue = (text: string, startMs: number, endMs: number): Cue => ({ startMs, endMs, text })

describe("cueAt", () => {
  const cues = [cue("Raz", 0, 1000), cue("Dwa", 1000, 2000), cue("Trzy", 5000, 6000)]

  it("finds the cue showing", () => {
    expect(cueAt(cues, 0)?.text).toBe("Raz")
    expect(cueAt(cues, 1500)?.text).toBe("Dwa")
    expect(cueAt(cues, 5999)?.text).toBe("Trzy")
  })

  it("hands over at the next start", () => {
    expect(cueAt(cues, 1000)?.text).toBe("Dwa")
  })

  it("finds nothing between cues or outside them", () => {
    expect(cueAt(cues, 3000)).toBeUndefined()
    expect(cueAt(cues, -1)).toBeUndefined()
    expect(cueAt(cues, 6000)).toBeUndefined()
    expect(cueAt([], 0)).toBeUndefined()
  })
})

describe("shownAt", () => {
  const cues = [
    cue("Raz", 0, 1000),
    cue("Dwa", 1000, 2000),
    cue("Trzy", 5000, 6000),
    cue("Cztery", 9100, 9500),
  ]

  it("shows the cue before above when it ended just before", () => {
    expect(shownAt(cues, 1500, true)).toEqual({ text: "Dwa", previous: { text: "Raz" } })
    expect(shownAt(cues, 5500, true)).toEqual({ text: "Trzy", previous: { text: "Dwa" } })
  })

  it("leaves out a cue before that ended long before, or none", () => {
    expect(shownAt(cues, 500, true)).toEqual({ text: "Raz", previous: undefined })
    expect(shownAt(cues, 9200, true)).toEqual({ text: "Cztery", previous: undefined })
    expect(shownAt(cues, 9000, true)).toBeUndefined()
    expect(shownAt(cues, -1, true)).toBeUndefined()
  })

  it("holds the cue that ended in the silence after it", () => {
    expect(shownAt(cues, 2000, true)).toEqual({ ...shownAt(cues, 1999, true), held: true })
    expect(shownAt(cues, 4999, true)).toMatchObject({ text: "Dwa", held: true })
    expect(shownAt(cues, 8999, true)).toMatchObject({ text: "Trzy", held: true })
    expect(shownAt(cues, 12_500, true)).toBeUndefined()
  })

  it("leaves out a cue before that was in another place", () => {
    const placed: Array<Cue> = [
      { startMs: 0, endMs: 1000, text: "Raz" },
      { startMs: 1000, endMs: 2000, text: "Dwa", place: { anchor: 4, x: 50, y: 55 } },
      { startMs: 2000, endMs: 3000, text: "Trzy", place: { anchor: 4, x: 50, y: 55 } },
    ]
    expect(shownAt(placed, 1500, true)?.previous).toBeUndefined()
    expect(shownAt(placed, 2500, true)?.previous).toEqual({ text: "Dwa" })
  })

  it("leaves styles and places out when told to", () => {
    const styled: Array<Cue> = [
      { startMs: 0, endMs: 1000, text: "Raz", styles: [{ color: "#ffff00", from: 0, to: 3 }] },
      { startMs: 1000, endMs: 2000, text: "Dwa", place: { anchor: 4, x: 50, y: 55 } },
    ]
    expect(shownAt(styled, 1500, false)).toEqual({ text: "Dwa", previous: { text: "Raz" } })
  })
})

describe("isFast", () => {
  /** Cues one after another, each on screen for its own time. */
  const paced = (...shown: Array<number>): Array<Cue> => {
    let startMs = 0
    return shown.map((ms, index) => {
      const cue = { startMs, endMs: startMs + ms, text: `${index}` }
      startMs += ms
      return cue
    })
  }

  it("is fast when most cues follow one shown under two seconds", () => {
    expect(isFast(paced(1500, 1800, 1200, 3000, 1600))).toBe(true)
  })

  it("is not when most cues stay longer", () => {
    expect(isFast(paced(2500, 1500, 4000, 3000, 6000))).toBe(false)
  })

  it("leaves out cues after a pause, which nothing slides into", () => {
    const apart = paced(1500, 1500, 1500).map((cue, index) => ({
      ...cue,
      startMs: cue.startMs + index * 5000,
      endMs: cue.endMs + index * 5000,
    }))
    expect(isFast(apart)).toBe(false)
  })
})

describe("inOrder", () => {
  it("joins cues that start together, with the styles of each", () => {
    const together: Array<Cue> = [
      { startMs: 0, endMs: 1000, text: "Raz", styles: [{ italic: true, from: 0, to: 3 }] },
      { startMs: 0, endMs: 2000, text: "Dwa", styles: [{ color: "#ffff00", from: 0, to: 3 }] },
    ]
    expect(inOrder(together)).toEqual([
      {
        startMs: 0,
        endMs: 2000,
        text: "Raz\nDwa",
        styles: [
          { italic: true, from: 0, to: 3 },
          { color: "#ffff00", from: 4, to: 7 },
        ],
      },
    ])
  })

  it("keeps a cue that carries on the one before as one, so it does not show again as the line before", () => {
    const line = { text: "Raz", styles: [{ color: "#ffff00", from: 0, to: 3 }] }
    expect(
      inOrder([
        { startMs: 0, endMs: 1000, ...line },
        { startMs: 1000, endMs: 3000, ...line },
        { startMs: 3000, endMs: 4000, text: "Raz" },
        { startMs: 5000, endMs: 6000, text: "Raz" },
      ]),
    ).toEqual([
      { startMs: 0, endMs: 3000, ...line },
      { startMs: 3000, endMs: 4000, text: "Raz" },
      { startMs: 5000, endMs: 6000, text: "Raz" },
    ])
  })
})
