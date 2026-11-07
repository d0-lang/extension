import type { ServerIssue } from "$lib/storage"

export type DialogState = "closed" | "add-open" | "review-open" | "saving"

export type ServerRow = {
  url: string
  name: string
  /** Mapped to this server, offered or not. */
  languages: Array<string>
  /** Mapped languages the server stopped listing. Lookups skip them. */
  unoffered: Array<string>
  issue: ServerIssue["kind"] | undefined
}
