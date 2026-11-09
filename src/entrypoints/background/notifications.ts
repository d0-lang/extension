/** Notifications about servers that moved, changed their key or policies, or failed verification at start. */
import type { CheckResult } from "./check"

const NOTIFICATION_PREFIX = "server:"

const notificationText = (result: CheckResult): { title: string; message: string } | undefined => {
  switch (result.kind) {
    case "moved":
      return {
        title: `${result.name} moved`,
        message: `It now answers at ${result.url}. DaDict updated its address.`,
      }
    case "identity":
      return {
        title: `${result.name} changed its identity`,
        message:
          "Its signing key is different. Lookups to it are paused until you review it in DaDict settings.",
      }
    case "legal":
      return {
        title: `${result.name} changed its policies`,
        message:
          "Its privacy policy or terms are new or changed. Lookups to it are paused until you review them in DaDict settings.",
      }
    case "broken":
      return {
        title: `Can't verify ${result.name}`,
        message: "Its answer failed the signature check. Lookups to it are paused until it verifies again.",
      }
    default:
      return undefined
  }
}

/** One notification for each result the user should know about. */
export const notify = (results: Array<CheckResult>) => {
  for (const result of results) {
    const text = notificationText(result)
    if (text !== undefined) {
      void browser.notifications.create(`${NOTIFICATION_PREFIX}${result.url}`, {
        type: "basic",
        iconUrl: browser.runtime.getURL("/icon/128.png"),
        ...text,
      })
    }
  }
}

export const isServerNotification = (notificationId: string): boolean =>
  notificationId.startsWith(NOTIFICATION_PREFIX)
