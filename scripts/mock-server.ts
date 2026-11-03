/**
 * Dictionary servers for testing the add flow, one per path: `http://localhost:8787/<scenario>`.
 * Open `http://localhost:8787` for the list and the controls. State lives in memory.
 */

type Scenario = {
  name: string
  languages: Array<string>
  verificationUrls: Array<string>
  /** Scenarios with the same group sign with the same key, as one server on two hosts would. */
  keyGroup?: string
  /** Body sent instead of metadata, pointing here. */
  newSource?: string
  fault?: "wrong-key" | "no-signature" | "bad-nonce" | "http-500" | "bad-body" | "slow"
  note: string
}

const PORT = Number(process.env.PORT ?? 8787)
const ORIGIN = `http://localhost:${PORT}`
const SLOW_MS = 4_000

const scenarios: Record<string, Scenario> = {
  basic: {
    name: "Test Polish",
    languages: ["pl_en"],
    verificationUrls: [`${ORIGIN}/basic/news`],
    note: "One language. The happy path.",
  },
  many: {
    name: "Big Multilingual Dictionary Server With A Long Name",
    languages: ["de_en", "fr_en", "es_en", "it_en", "pt_en", "nl_en", "pl_en", "uk_en", "ja_en", "zh_en", "ko_en", "lv_en"],
    verificationUrls: [`${ORIGIN}/many/news`, "https://example.org/status"],
    note: "Twelve languages and a long name. Overlaps basic on pl_en.",
  },
  overlap: {
    name: "German and Polish",
    languages: ["de_en", "pl_en"],
    verificationUrls: [],
    note: "Takes languages from basic or many. No verification pages.",
  },
  empty: {
    name: "No Languages Yet",
    languages: [],
    verificationUrls: [],
    note: "Lists no languages.",
  },
  rotate: {
    name: "Rotating Key",
    languages: ["de_en"],
    verificationUrls: [`${ORIGIN}/rotate/news`],
    note: "Add it, press rotate key, then edit languages: identity change.",
  },
  moved: {
    name: "Old Host",
    languages: ["fr_en"],
    verificationUrls: [],
    keyGroup: "moved",
    note: "Add it, press move, then edit languages: the domain-move path.",
  },
  "moved-target": {
    name: "New Host",
    languages: ["fr_en", "es_en"],
    verificationUrls: [`${ORIGIN}/moved-target/news`],
    keyGroup: "moved",
    note: "Where moved points once moved.",
  },
  broken: {
    name: "Broken Signature",
    languages: ["it_en"],
    verificationUrls: [],
    fault: "wrong-key",
    note: "Meta is signed with a different key than get-key serves.",
  },
  unsigned: {
    name: "Unsigned",
    languages: ["it_en"],
    verificationUrls: [],
    fault: "no-signature",
    note: "No X-Signature header.",
  },
  nonce: {
    name: "Stale Nonce",
    languages: ["it_en"],
    verificationUrls: [],
    fault: "bad-nonce",
    note: "Signed, but the nonce does not match.",
  },
  slow: {
    name: "Slow Server",
    languages: ["nl_en"],
    verificationUrls: [],
    fault: "slow",
    note: `Meta takes ${SLOW_MS / 1000} s.`,
  },
  down: {
    name: "Down",
    languages: [],
    verificationUrls: [],
    fault: "http-500",
    note: "Every request is a 500.",
  },
  garbage: {
    name: "",
    languages: ["NOT A PAIR"],
    verificationUrls: ["javascript:alert(1)"],
    note: "Signed meta that fails the schema.",
  },
}

/** Bumped by the rotate control, so the next key is a new one. */
const keyGeneration: Record<string, number> = {}

// An Ed25519 PKCS#8 key is this prefix followed by the 32-byte seed.
const PKCS8_PREFIX = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20])

const toBase64 = (bytes: ArrayBuffer | Uint8Array): string => Buffer.from(new Uint8Array(bytes)).toString("base64")

/** Same seed, same key, so a restart does not look like an identity change. */
const keyPair = async (seedText: string) => {
  const seed = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seedText)))
  const pkcs8 = new Uint8Array([...PKCS8_PREFIX, ...seed])
  const privateKey = await crypto.subtle.importKey("pkcs8", pkcs8, "Ed25519", true, ["sign"])
  const jwk = await crypto.subtle.exportKey("jwk", privateKey)
  const publicKey = Buffer.from(jwk.x ?? "", "base64url")
  return { privateKey, publicKey: toBase64(publicKey) }
}

const scenarioKey = (id: string, scenario: Scenario) => {
  const group = scenario.keyGroup ?? id
  return keyPair(`${group}#${keyGeneration[group] ?? 0}`)
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "X-Nonce",
  "Access-Control-Expose-Headers": "X-Signature",
}

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...cors, ...init.headers },
  })

const getMeta = async (id: string, scenario: Scenario, request: Request) => {
  if (scenario.fault === "slow") {
    await Bun.sleep(SLOW_MS)
  }
  const nonce = request.headers.get("x-nonce") ?? ""
  const body = JSON.stringify(
    scenario.newSource !== undefined
      ? { nonce, new_source: scenario.newSource }
      : {
          name: scenario.name,
          nonce: scenario.fault === "bad-nonce" ? "stale" : nonce,
          languages: scenario.languages,
          verification_urls: scenario.verificationUrls,
        },
  )
  const { privateKey } = scenario.fault === "wrong-key" ? await keyPair(`${id}#other`) : await scenarioKey(id, scenario)
  const signature = toBase64(await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(body)))
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      ...cors,
      ...(scenario.fault === "no-signature" ? {} : { "X-Signature": signature }),
    },
  })
}

const lookup = (scenario: Scenario, url: URL) => {
  const word = url.searchParams.get("word")
  const lang = url.searchParams.get("lang")
  if (word === null || word === "" || lang === null) {
    return json({ error: "bad_request" }, { status: 400 })
  }
  if (!scenario.languages.includes(lang)) {
    return json({ error: "unsupported_lang" }, { status: 400 })
  }
  return json({
    entries: [
      {
        lemma: word,
        pos: "NOUN",
        senses: [{ translations: [`${word} in ${lang}, answered by ${scenario.name}`] }],
      },
    ],
  })
}

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`)

const indexPage = () => {
  const rows = Object.entries(scenarios)
    .map(([id, scenario]) => {
      const group = scenario.keyGroup ?? id
      const controls = [
        `<a href="/_rotate/${id}">rotate key</a> (gen ${keyGeneration[group] ?? 0})`,
        id === "moved"
          ? scenario.newSource === undefined
            ? `<a href="/_move/${id}">move to moved-target</a>`
            : `<a href="/_unmove/${id}">undo move</a>`
          : "",
        `<form action="/_languages/${id}"><input name="v" value="${escapeHtml(scenario.languages.join(","))}" size="28"><button>set languages</button></form>`,
      ]
      return `<tr><td><code>${ORIGIN}/${id}</code></td><td>${escapeHtml(scenario.note)}</td><td>${controls.join(" ")}</td></tr>`
    })
    .join("")
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>dadict mock servers</title>
<style>body{font:14px system-ui;margin:24px}td{padding:6px 10px;border-top:1px solid #ddd;vertical-align:top}form{display:inline}</style>
<h1>dadict mock servers</h1><p>Paste a URL from the first column into Add server.</p>
<table>${rows}</table>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  )
}

const backToIndex = () => Response.redirect(`${ORIGIN}/`, 303)

Bun.serve({
  port: PORT,
  fetch: async (request) => {
    const url = new URL(request.url)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors })
    }
    if (url.pathname === "/") {
      return indexPage()
    }

    const [first = "", second = "", ...rest] = url.pathname.split("/").filter(Boolean)
    if (first.startsWith("_")) {
      const scenario = scenarios[second]
      if (scenario === undefined) {
        return new Response("unknown scenario", { status: 404 })
      }
      if (first === "_rotate") {
        const group = scenario.keyGroup ?? second
        keyGeneration[group] = (keyGeneration[group] ?? 0) + 1
      } else if (first === "_move") {
        scenario.newSource = `${ORIGIN}/moved-target`
      } else if (first === "_unmove") {
        delete scenario.newSource
      } else if (first === "_languages") {
        scenario.languages = (url.searchParams.get("v") ?? "").split(",").map((lang) => lang.trim()).filter(Boolean)
      }
      console.log(`${first} ${second}`)
      return backToIndex()
    }

    const scenario = scenarios[first]
    if (scenario === undefined) {
      return new Response("unknown scenario", { status: 404 })
    }
    const endpoint = [second, ...rest].join("/")
    console.log(`${request.method} /${first}/${endpoint}${url.search}`)
    if (scenario.fault === "http-500") {
      return json({ error: "internal" }, { status: 500 })
    }
    switch (endpoint) {
      case "v1/get-key":
        return json({ key: (await scenarioKey(first, scenario)).publicKey })
      case "v1/get-meta":
        return getMeta(first, scenario, request)
      case "v1/lookup":
        return lookup(scenario, url)
      case "news":
        return new Response(`<h1>${escapeHtml(scenario.name)}: server news</h1><p>Nothing to report.</p>`, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
      default:
        return new Response("not found", { status: 404 })
    }
  },
})

console.log(`Mock servers on ${ORIGIN}`)
