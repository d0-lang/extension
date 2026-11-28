import { describe, expect, it } from "vitest"
import { styledText } from "$lib/subtitles/markup"
import { aribMarkup, isArib } from "./arib"

/** What every cue of NHK's starts with: clear the screen, then its format, place and character size. */
const SCREEN = "[CS][CS][SWF_7][SDF_840_480][SDP_58_29][SHS_4][SVS_24][SSM_36_36]"

const read = (text: string) => styledText(aribMarkup(text))

describe("captions from Japanese TV", () => {
  it("are told by the commands they start with", () => {
    expect(isArib(`${SCREEN}[APS_7_2][WHF]♬〜`)).toBe(true)
    expect(isArib("[笑]　そうですね")).toBe(false)
    expect(isArib("Hello [CS]")).toBe(false)
  })

  it("have a line for each row, in the colour named", () => {
    expect(
      read(
        `${SCREEN}[MSZ][APS_6_5][NSZ][YLF][COL_4][COL_5_1]その威光を守るために[APS_7_2]人の命を軽んじるなと申しておるんじゃ！`,
      ),
    ).toEqual({
      text: "その威光を守るために\n人の命を軽んじるなと申しておるんじゃ！",
      styles: [
        { color: "#ffff00", from: 0, to: 10 },
        { color: "#ffff00", from: 11, to: 30 },
      ],
    })
  })

  it("keep the space between phrases, and white needs no style", () => {
    expect(read(`${SCREEN}[APS_7_5][GRF][COL_4][COL_5_1]ならば[MSZ]　[NSZ]目通りを禁ずる[MSZ]。`)).toEqual({
      text: "ならば 目通りを禁ずる。",
      styles: [{ color: "#00ff00", from: 0, to: 12 }],
    })
    expect(read(`${SCREEN}[APS_7_2][WHF][COL_4][COL_5_1]♬〜`)).toEqual({ text: "♬〜" })
  })

  it("count rows placed in small characters as half rows", () => {
    expect(
      read(
        `${SCREEN}[SSZ][APS_12_8][NSZ][YLF][COL_4][COL_5_1]京劇団の中での競争は[SSZ][APS_14_9][NSZ]とても激しいものでした[MSZ]。[TIME_53][CS]`,
      ).text,
    ).toBe("京劇団の中での競争は\nとても激しいものでした。")
  })

  it("put the reading over a word above the characters it is over", () => {
    expect(
      read(
        `${SCREEN}[SSZ][APS_12_10][NSZ][YLF][COL_4][COL_5_1]改易となるか[MSZ]　[NSZ]それとも[MSZ][APS_6_17][SSZ]おんごく[MSZ][APS_7_11][NSZ]どこか遠国にでも移封となるのか[MSZ]。`,
      ),
    ).toMatchObject({
      text: "改易となるか それとも\nどこか遠国にでも移封となるのか。",
      ruby: [{ from: 15, to: 17, text: "おんごく" }],
    })
    expect(
      read(
        `${SCREEN}[SSZ][APS_12_13][NSZ][WHF][COL_4][COL_5_1]殿下への年頭の御礼[APS_6_7][SSZ]まこと[NSZ][APS_7_7]真に行かぬおつもりですか[MSZ]。[TIME_63][TIME_7][CS]`,
      ),
    ).toEqual({
      text: "殿下への年頭の御礼\n真に行かぬおつもりですか。",
      ruby: [{ from: 10, to: 11, text: "まこと" }],
    })
  })

  it("leave out a reading over nothing", () => {
    expect(read(`${SCREEN}[APS_7_2][WHF]はっ！[APS_6_30][SSZ]よみ`)).toEqual({ text: "はっ！" })
  })

  it("keep a line whole around a reading over a word in it", () => {
    expect(read("[CS][APS_7_2]遠[MSZ][APS_6_3][SSZ]えん[MSZ][APS_7_3][NSZ]国").text).toBe("遠国")
  })
})
