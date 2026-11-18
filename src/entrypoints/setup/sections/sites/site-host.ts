/** The host of a typed site or pasted URL. A leading `www.` is dropped, so the block covers the whole site. */
export const siteHost = (input: string): string | undefined => {
  const text = input.trim().toLowerCase()
  const host = URL.parse(text.includes("://") ? text : `https://${text}`)?.hostname
  // A bare word like `gmail` would match no site.
  return host === undefined || (!host.includes(".") && host !== "localhost")
    ? undefined
    : host.replace(/^www\./, "")
}
