import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { defineConfig } from "wxt"
import tailwindcss from "@tailwindcss/vite"

/**
 * The first 7 characters of the commit the build is made from, or empty when nothing says. The
 * release workflow writes it to `BUILD_COMMIT` before zipping, so a build from the sources zip,
 * which has no `.git`, names the same commit as the build that was uploaded.
 */
const buildCommit = (): string => {
  try {
    return readFileSync("BUILD_COMMIT", "utf8").trim().slice(0, 7)
  } catch {}
  try {
    const head = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
    return head.trim().slice(0, 7)
  } catch {
    return ""
  }
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-svelte"],
  alias: {
    $lib: "src/lib",
  },
  vite: () => ({
    plugins: [tailwindcss()],
    define: { "import.meta.env.BUILD_COMMIT": JSON.stringify(buildCommit()) },
  }),
  manifest: ({ browser }) => ({
    name: "DaDict",
    description: "Look up words on any page using dictionary servers you choose.",
    permissions: ["storage", "contextMenus", "notifications", "alarms"],
    host_permissions: ["<all_urls>"],
    // WXT builds `marks.content.css` but leaves a style-only content script out of the manifest.
    content_scripts: [{ matches: ["<all_urls>"], all_frames: true, css: ["content-scripts/marks.css"] }],
    ...(browser === "firefox" && {
      browser_specific_settings: {
        gecko: {
          id: "dadict@dadict.extension",
          // Firefox added `data_collection_permissions` in 140.
          strict_min_version: "140.0",
          // Looked-up words from the page are sent to the servers the user binds.
          data_collection_permissions: { required: ["websiteContent"] },
        },
        // Android added it in 142.
        gecko_android: { strict_min_version: "142.0" },
      },
    }),
  }),
})
