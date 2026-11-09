import { describe, expect, it } from "vitest"
import { captionsFor, originalAudio, spokenLanguage, type AudioTrack, type CaptionTrack } from "./original"

// As the player gave them for the Japanese test video in an English browser. `Rb` is a name the player's build picks.
const dubbed = {
  id: "251;ChQKBWFjb250EgtkdWJiZWQtYXV0bwoNCgRsYW5nEgVlbi1VUw",
  Rb: { name: "English (US)", id: "en-US.10", isDefault: true, isAutoDubbed: true },
} as AudioTrack
const original = {
  id: "251;ChEKBWFjb250EghvcmlnaW5hbAoICgNkcmMSATEKCgoEbGFuZxICamE",
  Rb: { name: "Japanese original", id: "ja.4", isDefault: false, isAutoDubbed: false },
} as AudioTrack
const onlyTrack = {
  id: "und",
  Rb: { name: "Default", id: "und", isDefault: true, isAutoDubbed: false },
} as AudioTrack

const creatorEn: CaptionTrack = { languageCode: "en", kind: "" }
const creatorJa: CaptionTrack = { languageCode: "ja", kind: "" }
const autoJa: CaptionTrack = { languageCode: "ja", kind: "asr" }
const autoDe: CaptionTrack = { languageCode: "de", kind: "asr" }

describe("originalAudio", () => {
  it("finds the track marked original among dubs", () => {
    expect(originalAudio([dubbed, original])).toBe(original)
  })

  it("finds nothing when every track is dubbed", () => {
    expect(originalAudio([dubbed])).toBeUndefined()
  })
})

describe("spokenLanguage", () => {
  it("reads the original audio's language", () => {
    expect(spokenLanguage([dubbed, original], [creatorEn])).toBe("ja")
  })

  it("falls back to the auto captions when the video has one audio track", () => {
    expect(spokenLanguage([onlyTrack], [creatorEn, autoDe])).toBe("de")
    expect(spokenLanguage([], [{ languageCode: "en-US", kind: "asr" }])).toBe("en")
  })

  it("knows nothing without either", () => {
    expect(spokenLanguage([], [creatorEn])).toBeUndefined()
  })
})

describe("captionsFor", () => {
  const tracks = [creatorEn, creatorJa, autoJa]

  it("turns captions in the viewer's language to the creator's in the spoken one", () => {
    expect(captionsFor(creatorEn, tracks, "ja")).toBe(creatorJa)
  })

  it("turns a translation back to the track it came from", () => {
    expect(captionsFor({ ...autoJa, translationLanguage: { languageCode: "pl" } }, tracks, "ja")).toBe(
      creatorJa,
    )
  })

  it("takes the auto track when the creator has none in the spoken language", () => {
    expect(captionsFor(creatorEn, [creatorEn, autoJa], "ja")).toBe(autoJa)
  })

  it("leaves captions already in the spoken language", () => {
    expect(captionsFor(autoJa, tracks, "ja")).toBeUndefined()
    expect(captionsFor({ languageCode: "en-GB", kind: "" }, [creatorEn], "en")).toBeUndefined()
  })

  it("leaves captions alone when the spoken language is unknown or has no track", () => {
    expect(captionsFor(creatorEn, tracks, undefined)).toBeUndefined()
    expect(captionsFor(creatorEn, tracks, "pl")).toBeUndefined()
  })
})
