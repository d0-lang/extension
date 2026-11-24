import { describe, expect, it } from "vitest"
import { trackOf } from "./track"

const BASE = "https://www.youtube.com/api/timedtext?v=XwI2ku2_7rU&pot=token&fmt=json3"

const creatorBody = JSON.stringify({
  events: [{ tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: "こんにちは" }] }],
})
const asrBody = JSON.stringify({
  events: [
    {
      tStartMs: 0,
      dDurationMs: 3000,
      segs: [{ utf8: "こんにちは" }, { utf8: "今日", tOffsetMs: 500 }],
    },
  ],
})

describe("trackOf", () => {
  it("reads a creator track", () => {
    expect(trackOf({ url: `${BASE}&lang=ja`, body: creatorBody })).toEqual({
      videoId: "XwI2ku2_7rU",
      lang: "ja",
      translatedFrom: undefined,
      asr: false,
      cues: [{ startMs: 0, endMs: 1000, text: "こんにちは" }],
      fast: false,
    })
  })

  it("cuts an auto track", () => {
    const track = trackOf({ url: `${BASE}&kind=asr&lang=ja`, body: asrBody })
    expect(track?.asr).toBe(true)
    expect(track?.cues.map(({ text }) => text)).toEqual(["こんにちは今日"])
  })

  it("reads a translation as the language it was translated into", () => {
    const track = trackOf({ url: `${BASE}&kind=asr&lang=ja&tlang=pl`, body: creatorBody })
    expect(track).toMatchObject({ lang: "pl", translatedFrom: "ja", asr: true })
  })

  it("leaves out answers that are not a track", () => {
    expect(trackOf({ url: `${BASE}&lang=ja`, body: "<html>" })).toBeUndefined()
    expect(trackOf({ url: `${BASE}&lang=ja`, body: '{"events":"none"}' })).toBeUndefined()
    expect(trackOf({ url: BASE, body: creatorBody })).toBeUndefined()
    expect(trackOf({ url: "not a url", body: creatorBody })).toBeUndefined()
  })
})
