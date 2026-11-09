import { describe, expect, it, vi } from "vitest"
import { hookTimedtext, isTimedtextUrl } from "./hook"

const PAGE = "https://www.youtube.com/watch?v=XwI2ku2_7rU"
const TRACK = "/api/timedtext?v=XwI2ku2_7rU&lang=ja&pot=token&fmt=json3"

/** Stands in for the browser's, answering when the test says so. */
class FakeXhr extends EventTarget {
  responseType: XMLHttpRequestResponseType = ""
  responseText = ""
  response: unknown = null
  open(_method: string, _url: string) {}
  send() {}
  answer(body: string) {
    this.responseText = body
    this.response = body
    this.dispatchEvent(new Event("load"))
  }
}

const hooked = (fetch: typeof globalThis.fetch = vi.fn()) => {
  const win = {
    XMLHttpRequest: class extends FakeXhr {} as unknown as typeof XMLHttpRequest,
    fetch,
    location: { href: PAGE },
  }
  const sent: Array<[string, string]> = []
  hookTimedtext(win, (url, body) => sent.push([url, body]))
  const xhr = () => new win.XMLHttpRequest() as unknown as FakeXhr
  return { win, sent, xhr }
}

describe("isTimedtextUrl", () => {
  it("takes caption tracks in json3", () => {
    expect(isTimedtextUrl(TRACK, PAGE)).toBe(true)
  })

  it("leaves out other formats and other requests", () => {
    expect(isTimedtextUrl("/api/timedtext?lang=ja&fmt=srv3", PAGE)).toBe(false)
    expect(isTimedtextUrl("/youtubei/v1/player?fmt=json3", PAGE)).toBe(false)
  })
})

describe("hookTimedtext", () => {
  it("passes on a track the player downloads with XHR", () => {
    const { sent, xhr } = hooked()
    const request = xhr()
    request.open("GET", TRACK)
    request.send()
    request.answer('{"events":[]}')
    expect(sent).toEqual([[new URL(TRACK, PAGE).href, '{"events":[]}']])
  })

  it("passes on a track parsed as JSON", () => {
    const { sent, xhr } = hooked()
    const request = xhr()
    request.responseType = "json"
    request.open("GET", TRACK)
    request.send()
    request.responseText = ""
    request.response = { events: [] }
    request.dispatchEvent(new Event("load"))
    expect(sent.map(([, body]) => body)).toEqual(['{"events":[]}'])
  })

  it("leaves out the empty answer to a request without a token", () => {
    const { sent, xhr } = hooked()
    const request = xhr()
    request.open("GET", TRACK)
    request.send()
    request.answer("")
    expect(sent).toEqual([])
  })

  it("leaves out other requests, even on a reused XHR", () => {
    const { sent, xhr } = hooked()
    const request = xhr()
    request.open("GET", TRACK)
    request.open("GET", "/youtubei/v1/next")
    request.send()
    request.answer("{}")
    expect(sent).toEqual([])
  })

  it("passes on a track the page fetches, and hands the page its response untouched", async () => {
    const answer = new Response('{"events":[]}')
    const { win, sent } = hooked(vi.fn(() => Promise.resolve(answer)))
    const response = await win.fetch(TRACK)
    expect(response).toBe(answer)
    expect(await response.text()).toBe('{"events":[]}')
    await vi.waitFor(() => expect(sent).toEqual([[new URL(TRACK, PAGE).href, '{"events":[]}']]))
  })

  it("leaves a failed fetch to the page", async () => {
    const { win, sent } = hooked(vi.fn(() => Promise.reject(new TypeError("offline"))))
    await expect(win.fetch(TRACK)).rejects.toThrow("offline")
    expect(sent).toEqual([])
  })
})
