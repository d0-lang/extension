import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { decodeSubtitles, type Detect } from "./encoding"

const SRT = "1\n00:00:01,000 --> 00:00:02,000\nŻółw\n"

const bytesOf = (name: string): ArrayBuffer => {
  const file = readFileSync(new URL(`./fixtures/${name}`, import.meta.url))
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
}

/** Stands in for the browser's detection: a language for a word of it, which garbled text does not have. */
const detect: Detect = async (text) => {
  const words: Array<[string, RegExp]> = [
    ["ru", /спасибо/u],
    ["ja", /ありがとう/u],
    ["zh-CN", /谢谢/u],
    ["pl", /szybciej/u],
    ["fr", /merci/u],
  ]
  return words.flatMap(([language, word]) => (word.test(text) ? [{ language, percentage: 95 }] : []))
}

const read = (buffer: ArrayBuffer, lang?: string) => decodeSubtitles(buffer, lang, (text) => text, detect)

describe("decodeSubtitles", () => {
  it("reads UTF-8, with or without a byte order mark", async () => {
    const bytes = new TextEncoder().encode(SRT)
    expect(await read(bytes.buffer)).toBe(SRT)
    expect(await read(new Uint8Array([0xef, 0xbb, 0xbf, ...bytes]).buffer)).toBe(SRT)
  })

  it("reads UTF-16 that says so", async () => {
    const le = [
      0xff,
      0xfe,
      ...[...SRT].flatMap((char) => [char.charCodeAt(0) & 0xff, char.charCodeAt(0) >> 8]),
    ]
    expect(await read(new Uint8Array(le).buffer)).toBe(SRT)
  })

  it("reads an older file in the encoding of the language its name says", async () => {
    expect(await read(bytesOf("ru.windows-1251.srt"), "ru")).toContain("Привет, как дела?")
    expect(await read(bytesOf("ja.shift_jis.srt"), "ja")).toContain("こんにちは、元気ですか？")
    expect(await read(bytesOf("zh.gbk.srt"), "zh")).toContain("你好，你今天怎么样？")
    expect(await read(bytesOf("pl.windows-1250.srt"), "pl")).toContain("Żółw płynie szybciej niż łódź.")
    expect(await read(bytesOf("fr.windows-1252.srt"), "fr")).toContain("Ça va très bien")
  })

  it("finds the encoding of an older file whose name says no language by the language its text is in", async () => {
    expect(await read(bytesOf("ru.windows-1251.srt"))).toContain("Всё хорошо, спасибо.")
    expect(await read(bytesOf("ja.shift_jis.srt"))).toContain("はい、ありがとうございます。")
    expect(await read(bytesOf("zh.gbk.srt"))).toContain("我很好，谢谢你的关心。")
    expect(await read(bytesOf("pl.windows-1250.srt"))).toContain("Żółw płynie szybciej niż łódź.")
    expect(await read(bytesOf("fr.windows-1252.srt"))).toContain("Ça va très bien, merci beaucoup.")
  })

  it("keeps an encoding only when the language found in it is one saved in it", async () => {
    // Russian in Windows-1251 read as a Western encoding is garbled into accented letters, found to be Japanese here.
    const garbled: Detect = async (text) =>
      /[\u0400-\u04ff]/u.test(text)
        ? [{ language: "ru", percentage: 60 }]
        : /[À-ÿ]/u.test(text)
          ? [{ language: "ja", percentage: 99 }]
          : []
    const text = await decodeSubtitles(bytesOf("ru.windows-1251.srt"), undefined, (text) => text, garbled)
    expect(text).toContain("Привет")
  })

  it("takes a reading with half-width katakana for garbled, as a Western or Cyrillic file read as Shift_JIS is", async () => {
    const japanese: Detect = async (text) =>
      /[\uff61-\uff9f]/u.test(text) ? [{ language: "ja", percentage: 99 }] : []
    const text = await decodeSubtitles(bytesOf("ru.windows-1251.srt"), undefined, (text) => text, japanese)
    expect(text).not.toMatch(/[\uff61-\uff9f]/u)
  })

  it("reads a file nothing is found in as UTF-8, as before", async () => {
    const nothing: Detect = async () => []
    expect(
      await decodeSubtitles(bytesOf("ru.windows-1251.srt"), undefined, (text) => text, nothing),
    ).toContain("�")
  })
})
