/** Which of a server's policies the user has to accept again. */
import type { AcceptedLegal } from "../storage"
import type { ServerLegal } from "./types"

export type LegalDocument = "privacy" | "tos"

/** What saving the server records as accepted. */
export const acceptedLegal = (legal: ServerLegal | undefined): AcceptedLegal | null =>
  legal === undefined
    ? null
    : {
        privacyLink: legal.privacy_link,
        privacyHash: legal.privacy_hash,
        tosLink: legal.tos_link,
        tosHash: legal.tos_hash,
      }

/** Policies whose hash differs from the accepted one. Empty unless both sides have policies. */
export const changedDocuments = (
  accepted: AcceptedLegal | null | undefined,
  legal: ServerLegal | undefined,
): Array<LegalDocument> => {
  if (accepted === undefined || accepted === null || legal === undefined) {
    return []
  }
  return [
    ...(accepted.privacyHash === legal.privacy_hash ? [] : (["privacy"] as const)),
    ...(accepted.tosHash === legal.tos_hash ? [] : (["tos"] as const)),
  ]
}

/**
 * Whether the user has to accept the policies again before lookups go on.
 * Also true when the server added or dropped its policies, and for records stored before policies were read.
 * A moved link with the same hash is not a change.
 */
export const legalChanged = (
  accepted: AcceptedLegal | null | undefined,
  legal: ServerLegal | undefined,
): boolean => {
  if (accepted === null) {
    return legal !== undefined
  }
  if (accepted === undefined || legal === undefined) {
    return true
  }
  return changedDocuments(accepted, legal).length > 0
}
