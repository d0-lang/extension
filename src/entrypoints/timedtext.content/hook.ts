/** Reads the caption tracks the YouTube player downloads, since YouTube only answers requests that carry the player's token. */

type HookedWindow = Pick<typeof globalThis, "XMLHttpRequest" | "fetch"> & { location: { href: string } }

/** Whether `url` asks for a caption track in json3, the format the content script reads. */
export const isTimedtextUrl = (url: string, base: string): boolean => {
  const parsed = URL.parse(url, base)
  return parsed?.pathname === "/api/timedtext" && parsed.searchParams.get("fmt") === "json3"
}

const xhrBody = (xhr: XMLHttpRequest): string | undefined => {
  switch (xhr.responseType) {
    case "":
    case "text":
      return xhr.responseText
    case "json":
      return JSON.stringify(xhr.response)
    default:
      return undefined
  }
}

/**
 * Passes each caption track the page downloads to `send`, with its absolute URL.
 * Empty bodies are left out, because the player asks once before its token is ready and gets nothing.
 */
export const hookTimedtext = (win: HookedWindow, send: (url: string, body: string) => void) => {
  const sendBody = (url: string, body: string | undefined) => {
    if (body !== undefined && body !== "") {
      send(url, body)
    }
  }

  const urls = new WeakMap<XMLHttpRequest, string>()
  const { open, send: xhrSend } = win.XMLHttpRequest.prototype
  win.XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...args: Parameters<typeof open>) {
    const url = String(args[1])
    if (isTimedtextUrl(url, win.location.href)) {
      urls.set(this, new URL(url, win.location.href).href)
    } else {
      urls.delete(this)
    }
    return open.apply(this, args)
  } as typeof open
  win.XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, ...args: Parameters<typeof xhrSend>) {
    const url = urls.get(this)
    if (url !== undefined) {
      this.addEventListener("load", () => sendBody(url, xhrBody(this)), { once: true })
    }
    return xhrSend.apply(this, args)
  }

  const { fetch } = win
  win.fetch = (input, init) => {
    const response = fetch(input, init)
    const url = input instanceof Request ? input.url : String(input)
    if (isTimedtextUrl(url, win.location.href)) {
      const absolute = new URL(url, win.location.href).href
      void response
        .then((answer) => answer.clone().text())
        .then(
          (body) => sendBody(absolute, body),
          // The page handles its own failed requests.
          () => {},
        )
    }
    return response
  }
}
