import { describe, expect, it } from "vitest"
import { trackSiteOf } from "./sites"

describe("NHK", () => {
  const nhk = trackSiteOf("www.web.nhk")!

  it("is NHK ONE and NHK's other hosts, not other sites", () => {
    expect(nhk.id).toBe("nhk")
    expect(trackSiteOf("www3.nhk.or.jp")).toBe(nhk)
    expect(trackSiteOf("plus.nhk.jp")).toBe(nhk)
    expect(trackSiteOf("notnhk.jp")).toBeUndefined()
    expect(trackSiteOf("vimeo.com")).toBeUndefined()
  })

  it("finds the box NHK draws its captions in by what it holds", () => {
    document.body.innerHTML = `
      <div class="player">
        <video></video>
        <div class="_1s2jck42">
          <div class="_1s2jck44"><canvas></canvas><svg></svg><div class="tvplus-player__correction-container"></div></div>
          <div class="_1s2jck44"></div>
        </div>
      </div>`
    expect([...document.querySelectorAll(nhk.host.ownSubtitles)]).toEqual([
      document.querySelector("._1s2jck44"),
    ])
  })
})
