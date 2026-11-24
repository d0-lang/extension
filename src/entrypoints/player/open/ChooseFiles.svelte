<script lang="ts">
  import type { Snippet } from "svelte"

  /** A file picker for videos and subtitles, opened by whatever `button` draws. */
  let {
    onFiles,
    button,
    accept = "video/*,.mkv,.srt,.vtt,.ass,.ssa",
  }: {
    onFiles: (files: Iterable<File>) => void
    button: Snippet<[() => void]>
    accept?: string
  } = $props()

  let input: HTMLInputElement
</script>

<input
  bind:this={input}
  type="file"
  multiple
  {accept}
  hidden
  onchange={() => {
    onFiles([...(input.files ?? [])])
    // Choosing the same file again still fires `change`.
    input.value = ""
  }}
/>
{@render button(() => input.click())}
