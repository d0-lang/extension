/** The line under Servers in the sidebar. Unset while every server is fine. */
export const serversNote = (servers: number, issues: number): string | undefined =>
  issues === 0
    ? undefined
    : servers <= 1
      ? "Needs review"
      : `${issues} of ${servers} ${issues === 1 ? "needs" : "need"} review`

/** The line under Blocked sites in the sidebar. Unset while none are blocked. */
export const blockedNote = (blocked: number): string | undefined =>
  blocked === 0 ? undefined : `${blocked} ${blocked === 1 ? "site" : "sites"}`
