import type { Browser } from "wxt/browser"
import { reportPagePath } from "$lib/report-page"

/** Opens the report page for `tab`'s last lookup, next to it. Without a tab it reports the last lookup in any. */
export const openReportBeside = async (tab: Browser.tabs.Tab | undefined): Promise<void> => {
  await browser.tabs.create({
    url: browser.runtime.getURL(reportPagePath(tab?.id)),
    ...(tab === undefined ? {} : { index: tab.index + 1, windowId: tab.windowId, openerTabId: tab.id }),
  })
}
