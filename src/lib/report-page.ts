/**
 * The report page's address. It carries the tab the popup was opened over, whose last lookup it reports.
 * Without a tab, as from settings, it reports the last lookup in any tab.
 */

const REPORT_PAGE = "/report.html" as const

/** The page path for `runtime.getURL`, with `tabId` in its query when known. */
export const reportPagePath = (tabId: number | undefined): `/report.html${string}` =>
  tabId === undefined ? REPORT_PAGE : `${REPORT_PAGE}?tab=${tabId}`

/** Reads back the tab `reportPagePath` wrote. Unset for anything else. */
export const parseReportTab = (search: string): number | undefined => {
  const tab = new URLSearchParams(search).get("tab")
  return tab !== null && /^\d+$/.test(tab) ? Number(tab) : undefined
}
