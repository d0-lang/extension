/** The order the user dragged their languages into in the popover. */

const empty = {
  languageOrder: [] as Array<string>,
}

export const getLanguageOrder = async (): Promise<Array<string>> => {
  const { languageOrder } = await browser.storage.local.get("languageOrder")
  return Array.isArray(languageOrder) && languageOrder.every((code) => typeof code === "string")
    ? languageOrder
    : empty.languageOrder
}

export const setLanguageOrder = async (languageOrder: Array<string>): Promise<void> => {
  await browser.storage.local.set({ languageOrder })
}

/** `languages` with the ones in `order` first, as they are there. The rest keep their place after them. */
export const orderLanguages = (
  languages: ReadonlyArray<string>,
  order: ReadonlyArray<string>,
): Array<string> => [
  ...order.filter((code) => languages.includes(code)),
  ...languages.filter((code) => !order.includes(code)),
]
