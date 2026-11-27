import { describe, expect, it } from "vitest"
import { requested } from "./watch"

type Latest = Parameters<typeof requested>[0]

/** Feeds `requests` in the order they are reported, and lists the files read. */
const readsOf = (requests: ReadonlyArray<[string, number]>, failed: ReadonlySet<number> = new Set()) => {
  let latest: Latest
  const reads: Array<string> = []
  for (const [url, start] of requests) {
    const next = requested(latest, url, start, reads.length + 1)
    latest = next.latest
    if (next.read) {
      reads.push(url)
      if (failed.has(reads.length)) {
        latest = { ...latest!, failed: true }
      }
    }
  }
  return { reads, latest }
}

describe("requested", () => {
  it("reads the first request, and a later one for another file", () => {
    expect(
      readsOf([
        ["a", 100],
        ["b", 200],
      ]).reads,
    ).toEqual(["a", "b"])
  })

  it("skips a request that started before the latest, though it was reported after it", () => {
    expect(
      readsOf([
        ["b", 200],
        ["a", 100],
      ]).reads,
    ).toEqual(["b"])
  })

  it("does not read the file again when the player asks again, but takes that as the latest request", () => {
    const { reads, latest } = readsOf([
      ["a", 100],
      ["a", 300],
      ["b", 200],
    ])
    expect(reads).toEqual(["a"])
    expect(latest).toEqual({ url: "a", start: 300, failed: false, read: 1 })
  })

  it("reads a file again when reading it failed", () => {
    expect(
      readsOf(
        [
          ["a", 100],
          ["a", 300],
        ],
        new Set([1]),
      ).reads,
    ).toEqual(["a", "a"])
  })
})
