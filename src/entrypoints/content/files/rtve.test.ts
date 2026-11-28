import { describe, expect, it } from "vitest"
import { listedFile, RTVE_PIECE, rtveFileOf, rtveLanguage } from "./rtve"

const pieces = "https://rtvedrmstaging.rtve.es/13/27/17332713/dash_drm"

describe("RTVE's subtitle pieces", () => {
  it("are the subtitles' pieces, not the sound's or the picture's", () => {
    expect(RTVE_PIECE.test(`${pieces}/es/s_125.m4s?assetid=17332713`)).toBe(true)
    expect(RTVE_PIECE.test(`${pieces}/es/init_s.m4s?assetid=17332713`)).toBe(true)
    expect(RTVE_PIECE.test(`${pieces}/es/a_125.m4s?assetid=17332713`)).toBe(false)
    expect(RTVE_PIECE.test(`${pieces}/alta/v_125.m4s?assetid=17332713`)).toBe(false)
  })

  it("name their language by their folder", () => {
    expect(rtveLanguage(`${pieces}/en/s_1.m4s?assetid=17332713`)).toBe("en")
    expect(rtveLanguage(`${pieces}/va/s_1.m4s?assetid=17332713`)).toBe("ca")
    expect(rtveLanguage(`${pieces}/qar/s_1.m4s?assetid=17332713`)).toBe("oc")
  })

  it("are all of one file for each video and language", () => {
    const name = (url: string) => rtveFileOf(url)?.name
    expect(name(`${pieces}/es/s_1.m4s?assetid=17332713`)).toBe(name(`${pieces}/es/s_2.m4s?assetid=17332713`))
    expect(name(`${pieces}/es/s_1.m4s?assetid=17332713`)).not.toBe(
      name(`${pieces}/en/s_1.m4s?assetid=17332713`),
    )
    expect(name(`${pieces}/es/s_1.m4s?assetid=17332713`)).not.toBe(
      name(`${pieces}/es/s_1.m4s?assetid=17332714`),
    )
  })
})

describe("RTVE's list of subtitle files", () => {
  const list = (items: Array<{ src: string; lang: string }>) => JSON.stringify({ page: { items } })

  it("gives the file of the language", () => {
    const files = list([
      { src: "https://www.rtve.es/resources/vtt/6/2/1795786835526.vtt", lang: "es" },
      { src: "https://www.rtve.es/resources/vtt/2/3/1795786835632.vtt", lang: "en" },
    ])
    expect(listedFile(files, "en")._unsafeUnwrap()).toBe(
      "https://www.rtve.es/resources/vtt/2/3/1795786835632.vtt",
    )
    expect(listedFile(files, "gl").isErr()).toBe(true)
  })

  it("reads no file from elsewhere, or from a list that changed", () => {
    expect(listedFile(list([{ src: "https://example.com/es.vtt", lang: "es" }]), "es").isErr()).toBe(true)
    expect(listedFile(list([{ src: "http://www.rtve.es/es.vtt", lang: "es" }]), "es").isErr()).toBe(true)
    expect(listedFile(JSON.stringify({ items: [] }), "es").isErr()).toBe(true)
    expect(listedFile("<html>", "es").isErr()).toBe(true)
  })
})
