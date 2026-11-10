import { describe, expect, it } from "vitest"
import { TIMEDTEXT_EVENT, TIMEDTEXT_READY_EVENT } from "$lib/captions"
import { relayTimedtext } from "./relay"

const URL_JA = "https://www.youtube.com/api/timedtext?v=XwI2ku2_7rU&lang=ja&fmt=json3"
const URL_EN = "https://www.youtube.com/api/timedtext?v=XwI2ku2_7rU&lang=en&fmt=json3"

/** Stands in for the content script: it hears nothing until it listens, then says it does. */
const listen = (win: EventTarget): Array<string> => {
  const heard: Array<string> = []
  win.addEventListener(TIMEDTEXT_EVENT, (event) => {
    const { url } = JSON.parse((event as CustomEvent<string>).detail) as { url: string }
    heard.push(url)
  })
  win.dispatchEvent(new CustomEvent(TIMEDTEXT_READY_EVENT))
  return heard
}

describe("relayTimedtext", () => {
  it("passes on a track with its URL and body", () => {
    const win = new EventTarget()
    const details: Array<string> = []
    win.addEventListener(TIMEDTEXT_EVENT, (event) => details.push((event as CustomEvent<string>).detail))
    relayTimedtext(win)(URL_JA, "{}")
    expect(details.map((detail) => JSON.parse(detail) as unknown)).toEqual([{ url: URL_JA, body: "{}" }])
  })

  it("sends again the tracks from before the content script listened", () => {
    const win = new EventTarget()
    const send = relayTimedtext(win)
    send(URL_JA, "{}")
    send(URL_EN, "{}")
    expect(listen(win)).toEqual([URL_JA, URL_EN])
  })

  it("sends them again to a content script that starts later, as after the extension reloads", () => {
    const win = new EventTarget()
    const send = relayTimedtext(win)
    listen(win)
    send(URL_JA, "{}")
    expect(listen(win)).toEqual([URL_JA])
  })

  it("keeps only the latest tracks", () => {
    const win = new EventTarget()
    const send = relayTimedtext(win)
    const urls = Array.from({ length: 8 }, (_, index) => `${URL_JA}&n=${index}`)
    urls.forEach((url) => send(url, "{}"))
    expect(listen(win)).toEqual(urls.slice(-5))
  })
})
