/**
 * Dictionary servers for testing the add flow, one per path: `http://localhost:8787/<scenario>`.
 * Open `http://localhost:8787` for an overview with test steps and controls. State lives in memory.
 */

import { testPage, testPageLinks } from "./test-pages"

type Scenario = {
  name: string
  languages: Array<string>
  verificationUrls: Array<string>
  /** Protocol features listed in meta. */
  features?: Array<string>
  /** Meta `sources`, as sent. */
  sources?: Array<unknown>
  /** Scenarios with the same group sign with the same key, as one server on two hosts would. */
  keyGroup?: string
  /** Body sent instead of metadata, pointing here. */
  newSource?: string
  /** Whether `/v1/get-key` is a 404 once the scenario has moved, as on an address kept only to announce the move. */
  keylessOnceMoved?: boolean
  /** `false` lists no privacy policy or terms. Bumped by the policy control otherwise. */
  policyVersion?: number | false
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
    languages: [
      "de_en",
      "fr_en",
      "es_en",
      "it_en",
      "pt_en",
      "nl_en",
      "pl_en",
      "uk_en",
      "ja_en",
      "zh_en",
      "ko_en",
      "lv_en",
    ],
    verificationUrls: [`${ORIGIN}/many/news`, "https://example.org/status"],
    section: "adds",
    summary: "Twelve languages and a long name.",
    steps: ["Add basic first and tick Polish.", "Add this one and tick Polish too."],
    expect:
      'The list scrolls with the buttons still visible, and Select all shows. Polish reads "Used by Test Polish", then "Moves from Test Polish" once ticked.',
  },
  huge: {
    name: "Huge Dictionary",
    languages: [
      ..."de fr es it pt nl pl uk ru cs sk sl hr sr bg ro hu fi et lv lt sv da no is ga cy el tr ar he fa hi bn ur ta te th vi id ms tl ja zh ko ka hy kk sw"
        .split(" ")
        .map((lang) => `${lang}_en`),
      ..."en_de en_fr en_es en_ru en_uk en_pl ru_de uk_ru pl_de de_fr fr_de".split(" "),
    ],
    verificationUrls: [`${ORIGIN}/huge/news`],
    features: ["context", "context-match"],
    sources: [
      ...["Wiktionary", "Wikimedia Commons", "Forvo", "Tatoeba", "OpenRussian", "JMdict", "CC-CEDICT"].map(
        (name, index) => ({
          name,
          url: `https://source${index}.example/`,
          ...(index % 2 === 0 ? { license: "CC-BY-SA-4.0" } : {}),
        }),
      ),
      ...["de_en", "fr_en", "es_en", "it_en", "ja_en"].map((pair) => ({
        name: `Corpus ${pair}`,
        url: `https://corpus-${pair.replace("_", "-")}.example/`,
        license: "CC-BY-4.0",
        languages: [pair],
      })),
    ],
    section: "adds",
    summary:
      "Fifty languages into English, eleven into other languages, twelve sources, and it takes sentences.",
    expect:
      "Languages are grouped by the language they translate into. The list scrolls, Select all shows, and Sentences sits below it with All sites except blocked ones picked. Edit shows the choice that was saved. Sources show three, then 9 more sources.",
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
    expect: '"This server doesn\'t offer any languages yet." Add server stays disabled.',
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
  definitions: {
    name: "Test German Definitions",
    languages: ["de_de"],
    verificationUrls: [],
    section: "adds",
    summary:
      "A same-language pair, so its glosses are definitions: one sentence each, not short equivalents.",
    expect:
      "A German lookup shows numbered definitions that wrap across lines between words, never inside one, and the popover stays readable.",
  },
  credits: {
    name: "Test Wiktionary",
    languages: ["de_en", "ru_en"],
    verificationUrls: [],
    features: ["labels"],
    sources: [
      {
        name: "Wiktionary",
        url: "https://en.wiktionary.org/",
        license: "CC-BY-SA-4.0",
        license_url: "https://creativecommons.org/licenses/by-sa/4.0/",
      },
      {
        name: "Wikimedia Commons, the free media repository of the Wikimedia Foundation",
        url: "https://commons.wikimedia.org/",
      },
      // Covers only de_en, so its link on собака gets no row.
      { name: "German Wiktionary", url: "https://de.wiktionary.org/", languages: ["de_en"] },
      {
        name: `A source whose name runs past the hundred characters allowed${".".repeat(50)}`,
        url: "https://example.org/",
      },
    ],
    section: "adds",
    summary:
      "Credits Wiktionary and Wikimedia Commons under a long name, links each entry and recording, and explains its Russian labels. German Wiktionary covers only de_en, and one has a name over 100 characters.",
    steps: [
      "Add it and tick both languages.",
      "Look up Mutter or Haus on a German page, or собака or написать on a Russian one.",
      "Press Sources below the entries. Hover a label, or Tab to it.",
    ],
    expect:
      "The review and the card credit Wiktionary under CC-BY-SA-4.0, Commons under its long name, and German Wiktionary used for German → English only, not the source with the overlong name. Sources lists one row per page and per recording (two formats of one recording are one row), each named Wiktionary or Commons, with the long Commons name cut short and whole on hover, a German Wiktionary row for Mutter but not for собака, and no row for the tracker.example link. Other words show no Sources button. pos reads noun or verb. f, anim and pf show their name, pf also its text; inan has no explanation and stays a plain tag.",
  },
  testing: {
    name: "Testing Only",
    languages: ["sv_en"],
    verificationUrls: [],
    features: ["context"],
    policyVersion: false,
    section: "adds",
    summary: "Lists no privacy policy or terms, and takes sentences.",
    expect:
      '"No privacy policy or terms", naming sentences. Add server counts down 5 seconds. Edit languages later does not count down again.',
  },
  policy: {
    name: "Changing Policy",
    languages: ["fi_en"],
    verificationUrls: [],
    section: "steps",
    summary: "The server updates its privacy policy.",
    steps: [
      "Add it and tick Finnish.",
      "Press Update policy below.",
      "Reload the extension or restart the browser, which runs the startup check.",
      "Look up a Finnish word, then press Review on the card.",
    ],
    expect:
      'After the reload: a notification, a ! badge, and a red card saying lookups are paused. A Finnish lookup says lookups are paused. Review shows "Updated privacy policy" with the server\'s summary and a link. Saving clears the warning and lookups work again.',
  },
  rotate: {
    name: "Rotating Key",
    languages: ["de_en"],
    verificationUrls: [`${ORIGIN}/rotate/news`],
    section: "steps",
    summary: "The server replaces its signing key.",
    steps: [
      "Add it and tick German.",
      "Press Rotate key below.",
      "Reload the extension or restart the browser, which runs the startup check.",
      "Press Review on the card, or open ⋯ → Edit languages.",
    ],
    expect:
      'After the reload: a notification, a ! badge on the icon, a line in the popup, and a red card. Review shows "This server\'s identity has changed". Cancel has focus, and Trust new key counts down 5 seconds. Trusting and saving clears the warning.',
  },
  moved: {
    name: "Old Host",
    languages: ["fr_en"],
    verificationUrls: [],
    keyGroup: "moved",
    section: "steps",
    summary: "The server moves to a new address, keeping its key.",
    steps: [
      "Add it and tick French.",
      "Press Move to moved-target below.",
      "Reload the extension or restart the browser. Or, without reloading, open ⋯ → Edit languages on Old Host.",
    ],
    expect:
      'After the reload: a notification that Old Host moved, and the card is now New Host at /moved-target with French kept. No identity warning. Through Edit languages: a review with "This server has moved".',
  },
  "moved-keyless": {
    name: "Old Host Without Key",
    languages: ["fr_en"],
    verificationUrls: [],
    keyGroup: "moved",
    keylessOnceMoved: true,
    section: "steps",
    summary: "The server moves, and its old address then serves only the move: /v1/get-key is a 404.",
    steps: [
      "Add it and tick French.",
      "Press Move to moved-target below.",
      "Reload the extension or restart the browser. Or, without reloading, open ⋯ → Edit languages on it.",
    ],
    expect:
      "The same as for moved: a notification that it moved, and the card is now New Host at /moved-target. The stored key verifies the move, so the missing key does not matter.",
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
  japanese: {
    name: "Test Japanese",
    languages: ["ja_en"],
    verificationUrls: [`${ORIGIN}/japanese/sample`],
    features: ["context", "context-match"],
    section: "steps",
    summary:
      "Finds the whole word around a cut-short piece from the sentence, and splits it into logical pieces.",
    steps: [
      "Add it, tick Japanese, and let it take sentences.",
      `Open ${ORIGIN}/japanese/sample and hold Alt over 勉強 or 食, or any other piece of those words.`,
    ],
    expect:
      "The whole word is underlined (勉強しています, 食べました). The popover header splits it (勉強 + し + てい + ます), the piece you held over is tinted, and 勉強する or 食べる comes first with its kana reading under it. Without sentences, 勉強 and 食 answer only themselves.",
  },
  broken: {
    name: "Broken Signature",
    languages: ["it_en"],
    verificationUrls: [],
    fault: "wrong-key",
    section: "fails",
    summary: "Meta is signed with a different key than get-key serves.",
    expect: '"Can\'t verify this server".',
  },
  unsigned: {
    name: "Unsigned",
    languages: ["it_en"],
    verificationUrls: [],
    fault: "no-signature",
    section: "fails",
    summary: "No X-Signature header.",
    expect: '"Can\'t verify this server".',
  },
  nonce: {
    name: "Stale Nonce",
    languages: ["it_en"],
    verificationUrls: [],
    fault: "bad-nonce",
    section: "fails",
    summary: "Signed, but the nonce does not match the request.",
    expect: '"The server\'s answer did not match this request. Try again."',
  },
  garbage: {
    name: "",
    languages: ["NOT A PAIR"],
    verificationUrls: ["javascript:alert(1)"],
    section: "fails",
    summary: "Signed meta that fails the schema: empty name, bad language code, javascript: link.",
    expect: '"This does not look like a dictionary server."',
  },
  down: {
    name: "Down",
    languages: [],
    verificationUrls: [],
    fault: "http-500",
    section: "fails",
    summary: "Every request is a 500.",
    expect: '"The server answered with an error…" Details shows get-key failed: 500.',
  },
}

/** These languages know only these words, so a word from another language finds nothing. Others answer any word. */
const VOCABULARY: Record<string, Array<string>> = {
  pl_en: ["monarchia", "władza", "państwo", "państwach", "cesarstwo", "cesarstwa", "rzymskiego", "tytuły"],
  de_en: ["weltschmerz", "kaiser", "reich", "haus", "zeitgeist"],
}

/** What a same-language pair answers: definitions, which run as long as a sentence. */
const DEFINITIONS: Array<(word: string) => string> = [
  (word) =>
    `Ein Wort, das hier für „${word}“ steht und dessen Bedeutung in einem ganzen Satz erklärt wird, so wie ein einsprachiges Wörterbuch es tut.`,
  (word) => `Übertragen: etwas, das man mit „${word}“ vergleicht.`,
]

type MockEntry = {
  lemma: string
  pos: string
  labels?: Array<string>
  pron?: { reading?: string; ipa?: Array<string>; audio?: Array<{ url: string; source?: string }> }
  senses: Array<{ glosses: Array<string> }>
  sources?: Array<string>
  match?: Array<string>
}

/** A Wikimedia Commons recording: the file, and the file page that credits it. */
const commonsAudio = (file: string, hash: string) => ({
  url: `https://upload.wikimedia.org/wikipedia/commons/${hash[0]}/${hash}/${encodeURIComponent(file)}`,
  source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`,
})

const wiktionaryPage = (word: string, language: string) =>
  `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}#${language}`

/** What the credits scenario knows, by language and lowercase word. Any other word gets the plain answer, without links. */
const CREDITED_WORDS: Record<string, Record<string, Array<MockEntry>>> = {
  de_en: {
    mutter: [
      {
        lemma: "die Mutter",
        pos: "NOUN",
        pron: {
          ipa: ["/ˈmʊtɐ/"],
          // One recording in two formats, so the list shows it once.
          audio: [
            commonsAudio("De-Mutter.ogg", "03"),
            {
              url: "https://upload.wikimedia.org/wikipedia/commons/transcoded/0/03/De-Mutter.ogg/De-Mutter.ogg.mp3",
              source: commonsAudio("De-Mutter.ogg", "03").source,
            },
          ],
        },
        senses: [{ glosses: ["mother"] }, { glosses: ["nut (for a bolt)"] }],
        sources: [wiktionaryPage("Mutter", "German"), "https://de.wiktionary.org/wiki/Mutter"],
      },
      {
        lemma: "die Mutter",
        pos: "NOUN",
        senses: [{ glosses: ["mother superior"] }],
        // Not on a listed source's origin, so the client shows no link for it.
        sources: ["https://tracker.example/wiki/Mutter"],
      },
    ],
    haus: [
      {
        lemma: "das Haus",
        pos: "NOUN",
        pron: { audio: [commonsAudio("De-Haus.ogg", "7e")] },
        senses: [{ glosses: ["house"] }, { glosses: ["household, family"] }],
        sources: [wiktionaryPage("Haus", "German"), wiktionaryPage("Hauses", "German")],
      },
    ],
  },
  ru_en: {
    собака: [
      {
        lemma: "соба́ка",
        pos: "NOUN",
        labels: ["f", "anim"],
        pron: { audio: [commonsAudio("Ru-собака.ogg", "76")] },
        senses: [{ glosses: ["dog"] }, { glosses: ["at sign (@)"] }],
        sources: [
          wiktionaryPage("собака", "Russian"),
          "https://de.wiktionary.org/wiki/%D1%81%D0%BE%D0%B1%D0%B0%D0%BA%D0%B0",
        ],
      },
    ],
    написать: [
      {
        lemma: "написа́ть",
        pos: "VERB",
        labels: ["pf"],
        senses: [{ glosses: ["to write (down)"] }],
        sources: [wiktionaryPage("написать", "Russian")],
      },
    ],
    стол: [
      {
        lemma: "стол",
        pos: "NOUN",
        labels: ["m", "inan"],
        senses: [{ glosses: ["table"] }, { glosses: ["desk"] }],
        sources: [wiktionaryPage("стол", "Russian")],
      },
    ],
  },
}

// The test page has it in the instrumental.
CREDITED_WORDS.ru_en!.столом = CREDITED_WORDS.ru_en!.стол!

/** What the credits scenario's `/v1/get-labels` explains. `inan` is left out, so it shows without an explanation. */
const LABELS: Record<string, Record<string, { name: string; text?: string }>> = {
  ru_en: {
    f: { name: "feminine" },
    m: { name: "masculine" },
    anim: {
      name: "animate",
      text: "Names a person or an animal. Its accusative takes the genitive's form: вижу собаку, but вижу кота.",
    },
    pf: {
      name: "perfective",
      text: "The action is seen as a whole, usually completed. Most verbs come in pairs: писать (impf) and написать (pf).",
    },
  },
  de_en: {},
}

const getLabels = (scenario: Scenario, url: URL) => {
  const pairs = (url.searchParams.get("lang") ?? "").split(",").filter(Boolean)
  if (pairs.length === 0) {
    return json({ error: "bad_request" }, { status: 400 })
  }
  return json({
    labels: Object.fromEntries(
      pairs.filter((pair) => scenario.languages.includes(pair)).map((pair) => [pair, LABELS[pair] ?? {}]),
    ),
  })
}

const jaEntry = (lemma: string, pos: string, gloss: string, reading?: string): MockEntry => ({
  lemma,
  pos,
  ...(reading === undefined ? {} : { pron: { reading } }),
  senses: [{ glosses: [gloss] }],
})

/**
 * Japanese words the client's tokenizer cuts short. A piece of `whole` with `whole` in `context`
 * gets the whole word: the first entry's `match`, split by `segments`.
 */
const CUT_SHORT: Array<{
  whole: string
  entries: Array<MockEntry>
  segments: Array<{ text: string; entries?: Array<number> }>
}> = [
  {
    whole: "勉強しています",
    entries: [
      jaEntry("勉強する", "VERB", "to study", "べんきょうする"),
      jaEntry("勉強", "NOUN", "studying, study", "べんきょう"),
      jaEntry("する", "VERB", "to do"),
      jaEntry("ている", "AUX", "-ing; ongoing action or state"),
      jaEntry("ます", "AUX", "polite"),
    ],
    segments: [
      { text: "勉強", entries: [1] },
      { text: "し", entries: [2] },
      { text: "てい", entries: [3] },
      { text: "ます", entries: [4] },
    ],
  },
  {
    whole: "食べました",
    entries: [
      jaEntry("食べる", "VERB", "to eat", "たべる"),
      jaEntry("ます", "AUX", "polite"),
      jaEntry("た", "AUX", "past"),
    ],
    segments: [{ text: "食べ" }, { text: "ました", entries: [1, 2] }],
  },
]

/** What a Japanese word answers on its own, without a sentence to find the whole word in. */
const JA_WORDS: Record<string, MockEntry> = {
  勉強: jaEntry("勉強", "NOUN", "studying, study", "べんきょう"),
  食: jaEntry("食", "NOUN", "food; meal", "しょく"),
  寿司: jaEntry("寿司", "NOUN", "sushi", "すし"),
  日本語: jaEntry("日本語", "NOUN", "Japanese (language)", "にほんご"),
  毎日: jaEntry("毎日", "NOUN", "every day", "まいにち"),
}

const SAMPLE_SENTENCES = ["私は毎日日本語を勉強しています。", "昨日、寿司を食べました。"]

const lookupJapanese = (word: string, context: string | null) => {
  const cut = CUT_SHORT.find(({ whole }) => whole.includes(word) && context?.includes(whole) === true)
  if (cut !== undefined) {
    const [first, ...rest] = cut.entries
    return json({ entries: [{ ...first, match: [cut.whole] }, ...rest], segments: cut.segments })
  }
  const known = JA_WORDS[word]
  return json({ entries: known === undefined ? [] : [known] })
}

/** The state each scenario starts in, for the reset control. */
const initial = structuredClone(scenarios)

/** Bumped by the rotate control, so the next key is a new one. */
const keyGeneration: Record<string, number> = {}

// An Ed25519 PKCS#8 key is this prefix followed by the 32-byte seed.
const PKCS8_PREFIX = Uint8Array.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
])

const toBase64 = (bytes: ArrayBuffer | Uint8Array): string =>
  Buffer.from(new Uint8Array(bytes)).toString("base64")

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
  "Access-Control-Allow-Headers": "X-Nonce, Content-Type",
  "Access-Control-Expose-Headers": "X-Signature",
}

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...cors, ...init.headers },
  })

const sha256 = async (text: string): Promise<string> =>
  Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))).toString("hex")

const policyText = (id: string, document: "privacy" | "tos", version: number) =>
  `${id} ${document === "privacy" ? "privacy policy" : "terms of service"}, version ${version + 1}.`

const legal = async (id: string, version: number) => ({
  privacy_link: `${ORIGIN}/${id}/privacy`,
  privacy_hash: await sha256(policyText(id, "privacy", version)),
  ...(version > 0 ? { privacy_change: `Version ${version + 1}: lookups are now kept for 30 days.` } : {}),
  tos_link: `${ORIGIN}/${id}/tos`,
  tos_hash: await sha256(policyText(id, "tos", 0)),
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
          ...(scenario.features === undefined ? {} : { features: scenario.features }),
          ...(scenario.sources === undefined ? {} : { sources: scenario.sources }),
          ...(scenario.policyVersion === false
            ? {}
            : { legal: await legal(id, scenario.policyVersion ?? 0) }),
        },
  )
  const { privateKey } =
    scenario.fault === "wrong-key" ? await keyPair(`${id}#other`) : await scenarioKey(id, scenario)
  const signature = toBase64(await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(body)))
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      ...cors,
      ...(scenario.fault === "no-signature" ? {} : { "X-Signature": signature }),
    },
  })
}

/** A lookup is a POST with a JSON body, so a GET finds nothing here, as on a real server. */
const lookup = async (id: string, scenario: Scenario, request: Request) => {
  if (request.method !== "POST") {
    return new Response("not found", { status: 404 })
  }
  const body: unknown = await request.json().catch(() => undefined)
  const { word, lang, context } =
    typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {}
  if (typeof word !== "string" || word === "" || typeof lang !== "string") {
    return json({ error: "bad_request" }, { status: 400 })
  }
  if (!scenario.languages.includes(lang)) {
    return json({ error: "unsupported_lang" }, { status: 400 })
  }
  if (lang === "ja_en") {
    return lookupJapanese(word, typeof context === "string" ? context : null)
  }
  const credited = id === "credits" ? CREDITED_WORDS[lang]?.[word.toLowerCase()] : undefined
  if (credited !== undefined) {
    return json({ entries: credited })
  }
  if (VOCABULARY[lang]?.includes(word.toLowerCase()) === false) {
    return json({ entries: [] })
  }
  const [from, into] = lang.split("_")
  return json({
    entries: [
      {
        lemma: word,
        pos: "NOUN",
        senses:
          from === into
            ? DEFINITIONS.map((definition) => ({ glosses: [definition(word)] }))
            : [{ glosses: [`${word} in ${lang}, answered by ${scenario.name}`] }],
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
    typeof scenario.policyVersion === "number" && scenario.policyVersion > 0
      ? `<span class="badge">policy updated ×${scenario.policyVersion}</span>`
      : "",
  ].join("")
  const controls = [
    id === "rotate" ? `<a class="button" href="/_rotate/${id}">Rotate key</a>` : "",
    id === "policy" ? `<a class="button" href="/_policy/${id}">Update policy</a>` : "",
    id === "moved" || id === "moved-keyless"
      ? scenario.newSource === undefined
        ? `<a class="button" href="/_move/${id}">Move to moved-target</a>`
        : `<a class="button" href="/_unmove/${id}">Undo move</a>`
      : "",
    scenario.section === "fails"
      ? ""
      : `<details><summary>Change languages</summary><form action="/_languages/${id}"><input name="v" value="${escapeHtml(scenario.languages.join(","))}" placeholder="de_en,pl_en"><button>Set</button></form><p class="muted small">After a reload, dropped languages are struck through on the card. Edit languages shows added and removed ones.</p></details>`,
  ].join("")
  const steps =
    scenario.steps === undefined
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
<li>Compare what you see with <b>Expect</b>. Lookups answer with "&lt;word&gt; in &lt;lang&gt;, answered by &lt;server name&gt;". Only <code>pl_en</code> and <code>de_en</code> are picky: they know just ${Object.entries(
      VOCABULARY,
    )
      .map(([lang, words]) => `<code>${lang}</code>: ${words.join(", ")}`)
      .join(
        "; ",
      )}. So a German word on a Polish page finds nothing in <code>pl_en</code>. Every other language answers any word.</li>
</ol><p class="muted small" style="margin:8px 0 0">Keys come from fixed seeds, so servers you added still verify after a restart or a reset. A reset does undo rotated keys, so a rotated server you trusted shows an identity change again.</p></div>
${body}
<section><h2>Test pages</h2><p class="muted">Pages for checking lookups on the page itself. Add any server above first.</p><ul>${testPageLinks()}</ul></section>
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
const backToIndex = (id: string | undefined) =>
  Response.redirect(`${ORIGIN}/${id === undefined ? "" : `#${id}`}`, 303)

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
    if (first === "pages") {
      return testPage(second)
    }
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
      } else if (first === "_policy") {
        scenario.policyVersion = (scenario.policyVersion || 0) + 1
      } else if (first === "_move") {
        scenario.newSource = `${ORIGIN}/moved-target`
      } else if (first === "_unmove") {
        delete scenario.newSource
      } else if (first === "_languages") {
        scenario.languages = (url.searchParams.get("v") ?? "")
          .split(",")
          .map((lang) => lang.trim())
          .filter(Boolean)
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
        return scenario.keylessOnceMoved === true && scenario.newSource !== undefined
          ? json({ error: "not_found" }, { status: 404 })
          : json({ key: (await scenarioKey(first, scenario)).publicKey })
      case "v1/get-meta":
        return getMeta(first, scenario, request)
      case "v1/lookup":
        return lookup(first, scenario, request)
      case "v1/get-labels":
        return scenario.features?.includes("labels") === true
          ? getLabels(scenario, url)
          : new Response("not found", { status: 404 })
      case "sample":
        return new Response(
          `<!doctype html><html lang="ja"><meta charset="utf-8"><title>Japanese sample</title><body style="font:28px/2 system-ui,sans-serif;max-width:40em;margin:48px auto">${SAMPLE_SENTENCES.map((sentence) => `<p>${sentence}</p>`).join("")}</body></html>`,
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        )
      case "privacy":
      case "tos": {
        const version =
          scenario.policyVersion === false
            ? undefined
            : endpoint === "tos"
              ? 0
              : (scenario.policyVersion ?? 0)
        return version === undefined
          ? new Response("not found", { status: 404 })
          : new Response(policyText(first, endpoint, version), {
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
      }
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
