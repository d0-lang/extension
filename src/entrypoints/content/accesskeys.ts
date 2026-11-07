type LayoutKeyboard = { getLayoutMap: () => Promise<Map<string, string>> }

/** Chrome only. Elsewhere, and where a page's policy blocks it, the letters stay QWERTY. */
const layoutMap = (): Promise<Map<string, string> | undefined> => {
  const keyboard = (navigator as Navigator & { keyboard?: LayoutKeyboard }).keyboard
  return keyboard === undefined ? Promise.resolve(undefined) : keyboard.getLayoutMap().catch(() => undefined)
}

/** `KeyE` is `e` on QWERTY. */
const qwertyLetter = (code: string): string => code.replace(/^Key/, "").toLowerCase()

/** Remove the page's access keys for `letters`. The returned function puts back each one the page has not replaced. */
const removeAccessKeys = (letters: ReadonlyArray<string>): (() => void) => {
  const removed = [...document.querySelectorAll<HTMLElement>("[accesskey]")]
    .map((element) => ({ element, value: element.getAttribute("accesskey") ?? "" }))
    // The attribute can list several keys, separated by spaces.
    .filter(({ value }) =>
      value
        .toLowerCase()
        .split(/\s+/)
        .some((key) => letters.includes(key)),
    )
  for (const { element } of removed) {
    element.removeAttribute("accesskey")
  }
  return () => {
    for (const { element, value } of removed) {
      if (!element.hasAttribute("accesskey")) {
        element.setAttribute("accesskey", value)
      }
    }
  }
}

/**
 * Take the page's access keys off the letters typed by `codes`, until the returned function restores them.
 * Cancelling the keydown does not stop a browser from following an access key, like Alt + E for Edit on Wikipedia.
 * QWERTY letters go at once. The layout's own letters follow once the browser reports them.
 */
export const suspendAccessKeys = (codes: ReadonlyArray<string>): (() => void) => {
  const restores = [removeAccessKeys(codes.map(qwertyLetter))]
  let stopped = false
  void layoutMap().then((map) => {
    if (!stopped && map !== undefined) {
      restores.push(removeAccessKeys(codes.flatMap((code) => map.get(code) ?? [])))
    }
  })
  return () => {
    stopped = true
    for (const restore of restores) {
      restore()
    }
  }
}
