<script lang="ts">
  import { onMount } from "svelte"
  import type { ClassValue } from "svelte/elements"
  import type { SubtitleSettings } from "$lib/storage"
  import { createRows } from "$lib/subtitles/rows"
  import "$lib/subtitles/rows.css"
  import { SAMPLE_CUE_MS, SAMPLE_CUES } from "./sample"

  /** Sample lines playing over a still, drawn the way the subtitles show on a video, with the current settings. */
  let { settings, class: className }: { settings: SubtitleSettings; class?: ClassValue } = $props()

  let root = $state<HTMLElement>()
  let index = $state(0)

  /** Drawn again from scratch when a setting changes, so no slide comes from rows the old settings drew. */
  const rows = $derived(
    root === undefined
      ? undefined
      : createRows(root, { previous: settings.previous, slide: settings.slide }, () => {}),
  )

  $effect(() => {
    rows?.(
      {
        text: SAMPLE_CUES[index]!,
        previous: SAMPLE_CUES[(index + SAMPLE_CUES.length - 1) % SAMPLE_CUES.length],
      },
      "en",
      true,
    )
  })

  onMount(() => {
    const timer = setInterval(() => (index = (index + 1) % SAMPLE_CUES.length), SAMPLE_CUE_MS)
    return () => clearInterval(timer)
  })
</script>

<!-- A dusk sky over dark hills, so the subtitles sit on something like a video in either theme. Inert, since its words
     do nothing when clicked or selected. -->
<div
  class={[
    "relative aspect-video w-full overflow-hidden rounded-lg border bg-[linear-gradient(to_bottom,#1e293b,#475569_55%,#1f2937_56%,#111827)]",
    className,
  ]}
  inert
>
  <div
    bind:this={root}
    data-dadict-captions
    class={[
      "absolute left-1/2 w-max max-w-[90%] -translate-x-1/2 [--dadict-caption-size:15px]",
      settings.position === "top" ? "top-[6%]" : "bottom-[6%]",
    ]}
  ></div>
</div>
