import { defineConfig } from "wxt"
import tailwindcss from "@tailwindcss/vite"

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-svelte"],
  alias: {
    $lib: "src/lib",
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: ({ browser }) => ({
    name: "DaDict",
    description: "Look up words on any page using dictionary servers you choose.",
    permissions: ["storage", "contextMenus", "notifications"],
    host_permissions: ["<all_urls>"],
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
