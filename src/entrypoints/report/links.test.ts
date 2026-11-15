import { describe, expect, it } from "vitest"
import type { BoundServer, LastLookup } from "$lib/storage"
import { pageIssueLink, wordReport, wordReportLink } from "./links"

const SERVER = "https://dict.example"
const lookup: LastLookup = { word: "Mutter", lang: "de_en", server: SERVER }

const server = (reportUrl: string | undefined): BoundServer => ({
  url: SERVER,
  key: "k",
  name: "Dict",
  languages: ["de_en"],
  verificationUrls: [],
  ...(reportUrl === undefined ? {} : { reportUrl }),
})

describe("wordReportLink", () => {
  it("keeps the query the URL has, and adds word, lang and client, encoded", () => {
    const url = wordReportLink(
      "https://example.org/report?form=word&x=a%20b#top",
      { word: "für & mich", lang: "de_en" },
      "0.6.0",
    )
    expect(url?.href).toBe(
      "https://example.org/report?form=word&x=a+b&word=f%C3%BCr+%26+mich&lang=de_en&client=dadict%2F0.6.0#top",
    )
    expect([...(url?.searchParams.keys() ?? [])]).toEqual(["form", "x", "word", "lang", "client"])
  })

  it("matches the protocol's example", () => {
    expect(wordReportLink("https://example.org/report?form=word", lookup, "0.6.0")?.href).toBe(
      "https://example.org/report?form=word&word=Mutter&lang=de_en&client=dadict%2F0.6.0",
    )
  })

  it("opens nothing but https", () => {
    expect(wordReportLink("http://example.org/report", lookup, "0.6.0")).toBeUndefined()
    expect(wordReportLink("javascript:alert(1)", lookup, "0.6.0")).toBeUndefined()
  })
})

describe("wordReport", () => {
  it("names the word and the host it opens", () => {
    expect(
      wordReport(
        lookup,
        { [SERVER]: server("https://github.com/d0-lang/dict-server-ts/issues/new?template=word.yml") },
        "0.6.0",
      ),
    ).toEqual({
      href: "https://github.com/d0-lang/dict-server-ts/issues/new?template=word.yml&word=Mutter&lang=de_en&client=dadict%2F0.6.0",
      word: "Mutter",
      host: "github.com",
    })
  })

  it("is not shown before the tab's first answered lookup", () => {
    expect(wordReport(undefined, { [SERVER]: server("https://example.org/report") }, "0.6.0")).toBeUndefined()
  })

  it("is not shown when the answering server has no report_url, or is gone", () => {
    expect(wordReport(lookup, { [SERVER]: server(undefined) }, "0.6.0")).toBeUndefined()
    expect(wordReport(lookup, {}, "0.6.0")).toBeUndefined()
  })
})

describe("pageIssueLink", () => {
  it("fills in the browser and the version", () => {
    expect(pageIssueLink("Firefox 158.0 on Linux", "0.6.0")).toBe(
      "https://github.com/d0-lang/extension/issues/new?template=page.yml&browser=Firefox+158.0+on+Linux&version=0.6.0",
    )
  })

  it("leaves the browser for the reporter when it is not known", () => {
    expect(pageIssueLink(undefined, "0.6.0")).toBe(
      "https://github.com/d0-lang/extension/issues/new?template=page.yml&version=0.6.0",
    )
  })
})

describe("privacy", () => {
  const sentence = "Meine Mutter kocht heute."
  const page = "https://mail.example/inbox/42"
  // A lookup that somehow kept what the request carried besides the word.
  const leaky = { ...lookup, context: { text: sentence, at: 6 }, pageUrl: page } as LastLookup

  it("never puts the sentence or the page address in either link", () => {
    const report = wordReport(leaky, { [SERVER]: server("https://example.org/report") }, "0.6.0")
    const issue = pageIssueLink("Firefox 158.0 on Linux", "0.6.0")
    for (const href of [report?.href ?? "", issue]) {
      expect(decodeURIComponent(href.replaceAll("+", " "))).not.toContain("kocht")
      expect(decodeURIComponent(href)).not.toContain("mail.example")
    }
    expect([...new URL(report?.href ?? "").searchParams.keys()]).toEqual(["word", "lang", "client"])
    expect([...new URL(issue).searchParams.keys()]).toEqual(["template", "browser", "version"])
  })
})
