# DaDict

A browser extension for looking up words on any page, using dictionary servers you choose.

Hold <kbd>Alt</kbd> over a word, or right-click it and choose **Look up**. A popover shows the dictionary entries: meanings, part of speech, grammar labels, IPA and pronunciation. Works in Chrome and Firefox.

DaDict has no dictionary of its own. You add servers that speak the DaDict protocol and pick which of their languages to use. Each language is answered by one server.

## Features

- **Lookup on any page.** Hold <kbd>Alt</kbd> over a word, or use the context menu on a word or selection.
- **Phrases.** With the sentence around the word, a server can find the phrase it belongs to, like _in Kraft treten_ for _Kraft_ or _stattfinden_ for _fand … statt_. The phrase is listed first and underlined on the page.
- **Several languages.** The page's language is detected, so the right server answers. <kbd>A</kbd> / <kbd>D</kbd> switch languages, and the one you pick stays the default for that page.
- **Keyboard.** <kbd>W</kbd> / <kbd>S</kbd> scroll the popover, <kbd>E</kbd> plays the pronunciation, <kbd>Esc</kbd> closes it.
- **Russian and Ukrainian stress marks** drawn over the right letter, whatever the font.
- **Light and dark themes**, following the system or set by hand.

## Privacy

DaDict only talks to the servers you add.

- **What is sent:** the looked up word and its language. A server that supports it can also get the sentence the word is in. You choose this for each server when you add it: from all sites, from all sites except blocked ones, or never.
- **Blocked sites:** sites like mail or documents can be listed in Settings. Their sentences only go to servers set to get sentences from all sites.
- **Pronunciation audio** is played only from `upload.wikimedia.org`, over HTTPS.
- **Nothing else** leaves the browser. There is no analytics or tracking. Settings are kept in the browser's extension storage.

Servers sign what they send with an Ed25519 key. DaDict keeps the key from when you added the server and warns you if it changes.

## Permissions

| Permission      | Why                                                                 |
| --------------- | ------------------------------------------------------------------- |
| `<all_urls>`    | Find the word under the cursor on any page, and reach your servers. |
| `storage`       | Keep your servers, languages and settings.                          |
| `contextMenus`  | The **Look up** item in the right-click menu.                       |
| `notifications` | Tell you when a server moved or its key changed.                    |
| `alarms`        | Check your servers once a day while the browser stays open.         |

## Development

Requires [Bun](https://bun.sh) 1.4.4. Node.js is not needed, since Bun runs the build tools itself.

```sh
bun install
bun run dev            # Chrome, with live reload
bun run dev:firefox    # Firefox, with live reload
```

| Command                 | What it does                                           |
| ----------------------- | ------------------------------------------------------ |
| `bun run build`         | Production build for Chrome, in `.output/chrome-mv3`   |
| `bun run build:firefox` | Production build for Firefox, in `.output/firefox-mv2` |
| `bun run zip`           | Zip the Chrome build for the store                     |
| `bun run zip:firefox`   | Zip the Firefox build, plus a zip of the sources       |
| `bun run check`         | Type check                                             |
| `bun run test`          | Unit tests, and layout tests in Chromium               |
| `bun run format`        | Format with Prettier                                   |
| `bun run mock-server`   | Test dictionary servers on `http://localhost:8787`     |

Tests named `*.browser.test.ts` need real layout, so they run in headless Chromium. Install it once with `bunx playwright install chromium`.

The mock server runs a set of dictionary servers for trying out adding servers, key changes, moves and failures. Open `http://localhost:8787` for the list and what each one should do.

### Layout

| Path                            | What is there                                            |
| ------------------------------- | -------------------------------------------------------- |
| `src/entrypoints/background.ts` | Lookups, the context menu, and the server check at start |
| `src/entrypoints/content`       | Finding the word on the page, and the popover            |
| `src/entrypoints/popup`         | The toolbar button's popup                               |
| `src/entrypoints/setup`         | The settings page                                        |
| `src/lib/dict`                  | The protocol client: handshake, signatures, lookup       |
| `src/lib/storage.ts`            | Everything kept in extension storage                     |
| `scripts/mock-server.ts`        | The test dictionary servers                              |

Built with [WXT](https://wxt.dev), [Svelte](https://svelte.dev), [Tailwind CSS](https://tailwindcss.com) and [shadcn-svelte](https://shadcn-svelte.com).

## Building the Firefox add-on from source

These steps rebuild the add-on submitted to addons.mozilla.org, file for file.

Tested on:

- Arch Linux, x86-64
- Bun 1.4.4

Dependencies are pinned by `bun.lock`. npm does not read it, so use Bun. Node.js is not needed, since Bun runs the build tools itself.

1. Install Bun 1.4.4: `curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.4"`
2. In the unpacked source folder, install the exact dependency versions:

   ```sh
   bun install --frozen-lockfile
   ```

3. Build:

   ```sh
   bun run build:firefox
   ```

The add-on is in `.output/firefox-mv2`. Its files match the submitted zip. `bun run zip:firefox` packs it into `.output/dadict-<version>-firefox.zip`.
