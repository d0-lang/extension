import { describe, expect, it } from "vitest"
import { explanationOf, posName } from "./labels"

describe("posName", () => {
  it("names the UD tags", () => {
    expect(posName("NOUN")).toBe("noun")
    expect(posName("PROPN")).toBe("proper noun")
    expect(posName("AUX")).toBe("auxiliary")
  })

  it("leaves X empty and shows an unknown tag as sent", () => {
    expect(posName("X")).toBe("")
    expect(posName("NOUNISH")).toBe("NOUNISH")
    expect(posName("constructor")).toBe("constructor")
  })
})

describe("explanationOf", () => {
  const labels = { pf: { name: "perfective", text: "The action is seen as a whole." } }

  it("finds the label's own explanation", () => {
    expect(explanationOf(labels, "pf")).toEqual(labels.pf)
    expect(explanationOf(labels, "impf")).toBeUndefined()
  })

  it("does not take a name from the prototype", () => {
    expect(explanationOf(labels, "constructor")).toBeUndefined()
    expect(explanationOf(labels, "toString")).toBeUndefined()
  })
})
