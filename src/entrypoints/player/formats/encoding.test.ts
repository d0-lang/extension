import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { decodeSubtitles, type Detect } from "./encoding"

const SRT = "1\n00:00:01,000 --> 00:00:02,000\nŻółw\n"

const bytesOf = (name: string): ArrayBuffer => {
  const file = readFileSync(new URL(`./fixtures/${name}`, import.meta.url))
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
}

/**
 * Stands in for the browser's detection as it answers on these files: real text by its words, and text garbled into
 * Greek, Thai or Korean letters as surely in those languages, which is how it goes by script.
 */
const detect: Detect = async (text) => {
  const letters = [...text].filter((char) => /\p{L}/u.test(char))
  const mostlyIn = (script: RegExp) => letters.filter((char) => script.test(char)).length > letters.length / 2
  const found: Array<[string, boolean]> = [
    ["ru", /спасибо/u.test(text)],
    ["ja", /ありがとう/u.test(text)],
    ["zh", /谢谢/u.test(text)],
    ["zh-Hant", /謝謝/u.test(text)],
    ["pl", /szybciej/u.test(text)],
    ["fr", /merci/u.test(text)],
    ["el", mostlyIn(/[\u0370-\u03ff]/u)],
    ["th", mostlyIn(/[\u0e00-\u0e7f]/u)],
    ["ko", mostlyIn(/[\uac00-\ud7a3]/u)],
  ]
  return found.flatMap(([language, here]) =>
    here ? [{ language, percentage: language === "ru" ? 98 : 100 }] : [],
  )
}

const read = (buffer: ArrayBuffer, lang?: string) => decodeSubtitles(buffer, lang, (text) => text, detect)

describe("decodeSubtitles", () => {
  it("reads UTF-8, with or without a byte order mark", async () => {
    const bytes = new TextEncoder().encode(SRT)
    expect(await read(bytes.buffer)).toBe(SRT)
    expect(await read(new Uint8Array([0xef, 0xbb, 0xbf, ...bytes]).buffer)).toBe(SRT)
  })

  it("reads UTF-8 that says so, with a broken character in it replaced", async () => {
    const bytes = new TextEncoder().encode("Ça va très bien")
    const broken = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes, 0xc3])
    expect(await read(broken.buffer, "fr")).toBe("Ça va très bien\uFFFD")
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

  it("takes the most used encoding a language is found in, as text garbled into another script is found too", async () => {
    // Russian in Windows-1251 read as Greek or Thai is found to be Greek or Thai, more surely than Russian.
    expect(await read(bytesOf("ru.windows-1251.srt"))).toContain("Привет")
  })

  it("tells the encodings of a language apart, as one reads the other's bytes without an error", async () => {
    // Shift_JIS reads EUC-JP's kana as half-width katakana, and GBK reads Big5.
    expect(await read(bytesOf("ja.euc-jp.srt"), "ja")).toContain("はい、ありがとうございます。")
    expect(await read(bytesOf("ja.shift_jis.srt"), "ja")).toContain("はい、ありがとうございます。")
    expect(await read(bytesOf("zh-Hant.big5.srt"), "zh")).toContain("謝謝你的關心")
    expect(await read(bytesOf("zh.gbk.srt"), "zh")).toContain("谢谢你的关心")
  })

  it("reads a named file in whichever of its language's encodings it is valid in when no language is found", async () => {
    // 字 in EUC-JP, which is not valid Shift_JIS.
    const nothing: Detect = async () => []
    expect(await decodeSubtitles(new Uint8Array([0xbb, 0xfa]).buffer, "ja", (text) => text, nothing)).toBe(
      "字",
    )
  })

  it("leaves encodings that garbled text is found in as surely to the file's name", async () => {
    expect(await read(bytesOf("el.windows-1253.srt"), "el")).toContain("Γεια σου")
    expect(await read(bytesOf("ko.euc-kr.srt"), "ko")).toContain("안녕하세요")
    expect(await read(bytesOf("zh-Hant.big5.srt"))).toContain("謝謝你的關心")
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
