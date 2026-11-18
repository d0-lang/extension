import { describe, expect, it } from "vitest"
import { groupIntegrations, type Integration } from "./integrations"

const integration = (name: string): Integration => ({
  name,
  kind: "Video",
  description: "",
  key: name,
  get: async () => true,
  set: async () => {},
})

describe("groupIntegrations", () => {
  it("lists them under their kind, in order", () => {
    const list = [integration("YouTube"), integration("Vimeo")]
    expect(groupIntegrations(list)).toEqual([{ kind: "Video", items: list }])
  })

  it("keeps only names that hold the query, in any case", () => {
    const list = [integration("YouTube"), integration("Vimeo")]
    expect(
      groupIntegrations(list, " tube ").flatMap((group) => group.items.map((item) => item.name)),
    ).toEqual(["YouTube"])
    expect(groupIntegrations(list, "netflix")).toEqual([])
  })
})
