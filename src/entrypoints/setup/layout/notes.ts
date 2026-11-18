/** A line under a section's name in the sidebar. `alert` is a problem, `start` the next thing to do. */
export type Note = { text: string; tone?: "alert" | "start" }

/** Unset while every server is fine. Without any server, adding one is the first thing to do. */
export const serversNote = (servers: number, issues: number): Note | undefined =>
  servers === 0
    ? { text: "Add one to start", tone: "start" }
    : issues === 0
      ? undefined
      : {
          text:
            servers === 1
              ? "Needs review"
              : `${issues} of ${servers} ${issues === 1 ? "needs" : "need"} review`,
          tone: "alert",
        }

/** Unset while none are blocked. */
export const blockedNote = (blocked: number): Note | undefined =>
  blocked === 0 ? undefined : { text: `${blocked} ${blocked === 1 ? "site" : "sites"}` }
