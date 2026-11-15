import { describe, expect, it } from "vitest"
import { parseReportTab, reportPagePath } from "./report-page"

describe("report page address", () => {
  it("carries the tab there and back", () => {
    const path = reportPagePath(12)
    expect(path).toBe("/report.html?tab=12")
    expect(parseReportTab(new URL(path, "chrome-extension://x").search)).toBe(12)
  })

  it("leaves out a tab that is not known", () => {
    expect(reportPagePath(undefined)).toBe("/report.html")
    expect(parseReportTab("")).toBeUndefined()
  })

  it("ignores ids that are not whole numbers", () => {
    expect(parseReportTab("?tab=1e3")).toBeUndefined()
    expect(parseReportTab("?tab=-1")).toBeUndefined()
  })
})
