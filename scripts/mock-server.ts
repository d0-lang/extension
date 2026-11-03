/**
 * Dictionary servers for testing the add flow, one per path: `http://localhost:8787/<scenario>`.
 * Open `http://localhost:8787` for an overview with test steps and controls. State lives in memory.
 */

type Scenario = {
  name: string
  languages: Array<string>
  verificationUrls: Array<string>
  /** Scenarios with the same group sign with the same key, as one server on two hosts would. */
  keyGroup?: string
  /** Body sent instead of metadata, pointing here. */
  newSource?: string
  fault?: "wrong-key" | "no-signature" | "bad-nonce" | "http-500" | "slow"
  /** Where the overview page lists it. */
  section: Section
  summary: string
  steps?: Array<string>
  expect: string
}

type Section = "adds" | "steps" | "fails"

const PORT = Number(process.env.PORT ?? 8787)
const ORIGIN = `http://localhost:${PORT}`
const SLOW_MS = 4_000

const scenarios: Record<string, Scenario> = {
  basic: {
    name: "Test Polish",
    languages: ["pl_en"],
    verificationUrls: [`${ORIGIN}/basic/news`],
    section: "adds",
    summary: "One language. The happy path.",
    expect: "Review titled Test Polish with Polish → English. Add server saves it.",
  },
  many: {
    name: "Big Multilingual Dictionary Server With A Long Name",
    languages: ["de_en", "fr_en", "es_en", "it_en", "pt_en", "nl_en", "pl_en", "uk_en", "ja_en", "zh_en", "ko_en", "lv_en"],
    verificationUrls: [`${ORIGIN}/many/news`, "https://example.org/status"],
    section: "adds",
    summary: "Twelve languages and a long name.",
    steps: ["Add basic first and tick Polish.", "Add this one and tick Polish too."],
    expect: "The list scrolls with the buttons still visible, and Select all shows. Polish reads \"Used by Test Polish\", then \"Moves from Test Polish\" once ticked.",
  },
  overlap: {
    name: "German and Polish",
    languages: ["de_en", "pl_en"],
    verificationUrls: [],
    section: "adds",
    summary: "Shares languages with basic and many. No verification pages.",
    expect: "Languages another server has say which one. Saving moves the ticked ones here.",
  },
  empty: {
    name: "No Languages Yet",
    languages: [],
    verificationUrls: [],
    section: "adds",
    summary: "Lists no languages.",
    expect: "\"This server doesn't offer any languages yet.\" Add server stays disabled.",
  },
  slow: {
    name: "Slow Server",
    languages: ["nl_en"],
    verificationUrls: [],
    fault: "slow",
    section: "adds",
    summary: `Meta takes ${SLOW_MS / 1000} seconds.`,
    expect: "Connecting… for a few seconds, then the review. Closing the dialog meanwhile drops the attempt.",
  },
  rotate: {
    name: "Rotating Key",
    languages: ["de_en"],
    verificationUrls: [`${ORIGIN}/rotate/news`],
    section: "steps",
    summary: "The server replaces its signing key.",
    steps: ["Add it and tick German.", "Press Rotate key below.", "In settings, open ⋯ → Edit languages on Rotating Key."],
    expect: "\"This server's identity has changed\" with the news page. Cancel has focus, and Trust new key counts down 5 seconds. Trusting leads on to the review.",
  },
  moved: {
    name: "Old Host",
    languages: ["fr_en"],
    verificationUrls: [],
    keyGroup: "moved",
    section: "steps",
    summary: "The server moves to a new address, keeping its key.",
    steps: ["Add it and tick French.", "Press Move to moved-target below.", "In settings, open ⋯ → Edit languages on Old Host."],
    expect: "Review of New Host at /moved-target with \"This server has moved\". Saving replaces Old Host. No identity warning.",
  },
  "moved-target": {
    name: "New Host",
    languages: ["fr_en", "es_en"],
    verificationUrls: [`${ORIGIN}/moved-target/news`],
    keyGroup: "moved",
    section: "steps",
    summary: "Where moved points once moved. Same key as moved.",
    expect: "Adds fine on its own too.",
  },
  broken: {
    name: "Broken Signature",
    languages: ["it_en"],
    verificationUrls: [],
    fault: "wrong-key",
    section: "fails",
    summary: "Meta is signed with a different key than get-key serves.",
    expect: "\"Can't verify this server\".",
  },
  unsigned: {
    name: "Unsigned",
    languages: ["it_en"],
    verificationUrls: [],
    fault: "no-signature",
    section: "fails",
    summary: "No X-Signature header.",
    expect: "\"Can't verify this server\".",
  },
  nonce: {
    name: "Stale Nonce",
    languages: ["it_en"],
    verificationUrls: [],
    fault: "bad-nonce",
    section: "fails",
    summary: "Signed, but the nonce does not match the request.",
    expect: "\"The server's answer did not match this request. Try again.\"",
  },
  garbage: {
    name: "",
    languages: ["NOT A PAIR"],
    verificationUrls: ["javascript:alert(1)"],
    section: "fails",
    summary: "Signed meta that fails the schema: empty name, bad language code, javascript: link.",
    expect: "\"This does not look like a dictionary server.\"",
  },
  down: {
    name: "Down",
    languages: [],
    verificationUrls: [],
    fault: "http-500",
    section: "fails",
    summary: "Every request is a 500.",
    expect: "\"The server answered with an error…\" Details shows get-key failed: 500.",
  },
}

/** The state each scenario starts in, for the reset control. */
const initial = structuredClone(scenarios)

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

const sections: Array<{ id: Section; title: string; intro: string }> = [
  { id: "adds", title: "Should add", intro: "Paste the address into Add server and connect." },
  { id: "steps", title: "Takes a few steps", intro: "Use the controls on the card between steps." },
  { id: "fails", title: "Should fail", intro: "Connecting shows an error and nothing is saved." },
]

const card = (id: string, scenario: Scenario) => {
  const group = scenario.keyGroup ?? id
  const generation = keyGeneration[group] ?? 0
  const address = `${ORIGIN}/${id}`
  const state = [
    scenario.languages.length === 0
      ? `<span class="muted">No languages</span>`
      : scenario.languages.map((lang) => `<span class="chip">${escapeHtml(lang)}</span>`).join(""),
    generation > 0 ? `<span class="badge">key rotated ×${generation}</span>` : "",
    scenario.newSource !== undefined ? `<span class="badge">moved → moved-target</span>` : "",
  ].join("")
  const controls = [
    id === "rotate" ? `<a class="button" href="/_rotate/${id}">Rotate key</a>` : "",
    id === "moved"
      ? scenario.newSource === undefined
        ? `<a class="button" href="/_move/${id}">Move to moved-target</a>`
        : `<a class="button" href="/_unmove/${id}">Undo move</a>`
      : "",
    scenario.section === "fails"
      ? ""
      : `<details><summary>Change languages</summary><form action="/_languages/${id}"><input name="v" value="${escapeHtml(scenario.languages.join(","))}" placeholder="de_en,pl_en"><button>Set</button></form><p class="muted small">Then use Edit languages in settings to see added and removed ones.</p></details>`,
  ].join("")
  const steps = scenario.steps === undefined
    ? ""
    : `<ol>${scenario.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>`
  return `<article id="${id}">
  <header><h3>${escapeHtml(scenario.name || "(no name)")}</h3><span class="muted small">${escapeHtml(id)}</span></header>
  <div class="address"><code>${address}</code><button type="button" data-copy="${address}">Copy</button></div>
  <p>${escapeHtml(scenario.summary)}</p>
  ${steps}
  <p class="expect"><b>Expect:</b> ${escapeHtml(scenario.expect)}</p>
  <div class="state">${state}</div>
  <div class="controls">${controls}</div>
</article>`
}

const indexPage = () => {
  const body = sections
    .map(({ id, title, intro }) => {
      const cards = Object.entries(scenarios)
        .filter(([, scenario]) => scenario.section === id)
        .map(([scenarioId, scenario]) => card(scenarioId, scenario))
        .join("")
      return `<section><h2>${title}</h2><p class="muted">${intro}</p><div class="grid">${cards}</div></section>`
    })
    .join("")
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>dadict mock servers</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#111;--muted:#666;--card:#f6f6f7;--border:#e3e3e6;--accent:#4f46e5;--chip:#e9e9ee}
@media (prefers-color-scheme:dark){:root{--bg:#0b0b0c;--fg:#f2f2f3;--muted:#9a9aa2;--card:#161618;--border:#2a2a2e;--accent:#818cf8;--chip:#26262b}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:32px 24px 64px}
h1{margin:0 0 4px;font-size:22px}h2{margin:36px 0 2px;font-size:17px}h3{margin:0;font-size:15px}
.muted{color:var(--muted)}.small{font-size:12px}
.intro{display:flex;flex-wrap:wrap;gap:12px 24px;align-items:center;justify-content:space-between}
.how{margin:16px 0 0;padding:14px 16px;border:1px solid var(--border);border-radius:10px}.how ol{margin:6px 0 0;padding-left:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px;margin-top:12px}
article{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:8px;scroll-margin-top:16px}
article:target{outline:2px solid var(--accent)}
article header{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
article p,article ol{margin:0}article ol{padding-left:20px}
.address{display:flex;gap:8px;align-items:center}.address code{flex:1;font-size:12.5px;word-break:break-all}
.expect{border-left:3px solid var(--accent);padding-left:8px}
.state{display:flex;flex-wrap:wrap;gap:4px}
.chip{background:var(--chip);border-radius:99px;padding:1px 8px;font-size:12px;font-family:ui-monospace,monospace}
.badge{border:1px solid var(--accent);color:var(--accent);border-radius:99px;padding:0 8px;font-size:12px}
.controls{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin-top:auto;padding-top:4px}
button,.button{font:inherit;font-size:13px;border:1px solid var(--border);background:var(--bg);color:var(--fg);border-radius:6px;padding:3px 10px;cursor:pointer;text-decoration:none}
.button{border-color:var(--accent);color:var(--accent)}
details summary{cursor:pointer;color:var(--accent);font-size:13px}details form{display:flex;gap:6px;margin-top:6px}
input{font:12.5px ui-monospace,monospace;flex:1;min-width:0;padding:3px 6px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--fg)}
</style>
<main>
<div class="intro"><div><h1>dadict mock servers</h1><p class="muted" style="margin:0">Each card is a separate dictionary server. State lives in memory until the server restarts.</p></div>
<a class="button" href="/_reset">Reset everything</a></div>
<div class="how"><b>How to test</b><ol>
<li>Open the extension's settings and press <b>Add server</b>.</li>
<li>Copy an address from a card below. A bare host like <code>localhost:8787/basic</code> works too.</li>
<li>Compare what you see with <b>Expect</b>. Lookups on any added server answer with "&lt;word&gt; in &lt;lang&gt;, answered by &lt;server name&gt;".</li>
</ol><p class="muted small" style="margin:8px 0 0">Keys come from fixed seeds, so servers you added still verify after a restart or a reset. A reset does undo rotated keys, so a rotated server you trusted shows an identity change again.</p></div>
${body}
</main>
<script>
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-copy]")
  if (!button) return
  navigator.clipboard.writeText(button.dataset.copy).then(() => {
    button.textContent = "Copied"
    setTimeout(() => (button.textContent = "Copy"), 1200)
  })
})
</script>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  )
}

/** Back to the card that was used, so the page does not jump to the top. */
const backToIndex = (id: string | undefined) => Response.redirect(`${ORIGIN}/${id === undefined ? "" : `#${id}`}`, 303)

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
    if (first === "_reset") {
      for (const [id, scenario] of Object.entries(structuredClone(initial))) {
        scenarios[id] = scenario
      }
      for (const group of Object.keys(keyGeneration)) {
        delete keyGeneration[group]
      }
      console.log("_reset")
      return backToIndex(undefined)
    }
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
      return backToIndex(second)
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
