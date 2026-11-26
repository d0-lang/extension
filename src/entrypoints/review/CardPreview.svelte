<script lang="ts">
  import { BACK, CSS } from "$lib/anki/note-type"
  import { renderTemplate } from "./preview"

  let {
    fields,
    audio,
    dark,
  }: {
    /** The note's fields as HTML, which `fields.ts` escaped. */
    fields: Record<string, string>
    /** Whether a recording goes with the card, which shows as Anki's play button. */
    audio: boolean
    dark: boolean
  } = $props()

  // Anki's own play button, drawn here since Anki puts it in when it stores the recording.
  const PLAY = `<a class="replay-button"><svg viewBox="0 0 64 64" width="1.4em" height="1.4em" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" stroke-width="3" opacity=".5"/><path d="M26 20 L46 32 L26 44 Z" fill="currentColor"/></svg></a>`

  // Anki's colours in each theme, which the note type's CSS reads.
  const THEMES = `
    .card { padding: 0.75rem 0; font-size: 16px; }
    .replay-button { color: var(--fg-subtle); display: inline-flex; }
    .nightMode { --fg: #e5e5e5; --canvas: #2c2c2c; --fg-subtle: #a3a3a3; --border: #4a4a4a; }`

  const html = $derived(
    `<style>${CSS}${THEMES}</style><div class="card${dark ? " nightMode" : ""}">${renderTemplate(BACK, {
      ...fields,
      Audio: audio ? PLAY : "",
    })}</div>`,
  )

  /** In a shadow root, so the note type's CSS stays out of the page and the page's out of the card. */
  const shadow = (host: HTMLElement) => {
    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" })
    $effect(() => {
      root.innerHTML = html
    })
  }
</script>

<div {@attach shadow} class="overflow-hidden rounded-lg border" aria-label="How the card looks in Anki"></div>
