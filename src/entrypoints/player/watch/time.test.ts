import { describe, expect, it } from "vitest"
import { formatTime } from "./time"

describe("formatTime", () => {
  it("shows minutes and seconds, and hours once there are some", () => {
    expect(formatTime(245.9)).toBe("4:05")
    expect(formatTime(3723)).toBe("1:02:03")
  })

  it("shows nothing played for a length not known yet", () => {
    expect(formatTime(Number.NaN)).toBe("0:00")
  })
})
