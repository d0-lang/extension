<script lang="ts">
  import type { ClassValue } from "svelte/elements"
  import { ToggleGroupItem } from "$lib/components/ui/toggle-group"
  import type { SubtitleSettings } from "$lib/storage"
  import { createRows, type Styled } from "$lib/subtitles/rows"
  import "$lib/subtitles/rows.css"
  import Choice from "../../controls/Choice.svelte"
  import { SAMPLES, type Pace } from "./sample"

  /**
   * Sample lines playing over a still, drawn the way the subtitles show on a video, with the current settings.
   * Slow and fast lines can be played, to compare how each shows.
   */
  let { settings, class: className }: { settings: SubtitleSettings; class?: ClassValue } = $props()

  let root = $state<HTMLElement>()
  let pace = $state<Pace>("slow")
  let index = $state(0)
  const cues = $derived(SAMPLES[pace])

  /**
   * Drawn again from scratch when a setting or the pace changes, so no slide comes from rows drawn before.
   * Fast lines slide only while Calm fast subtitles is off, as a fast video's would.
   */
  const rows = $derived(
    root === undefined
      ? undefined
      : createRows(
          root,
          { previous: settings.previous, slide: settings.slide && !(settings.calm && pace === "fast") },
          () => {},
        ),
  )

  /** The sample line at `at`, in its speaker's colour when subtitle styles show. */
  const sample = (at: number): Styled => {
    const { text, color } = cues[(at + cues.length) % cues.length]!
    return settings.styles ? { text, styles: [{ color, from: 0, to: text.length }] } : { text }
  }

  $effect(() => {
    rows?.({ ...sample(index), previous: sample(index - 1) }, "en", true)
  })

  // Each line shows for its own time, so the fast ones come at uneven times.
  $effect(() => {
    const next = (index + 1) % cues.length
    const timer = setTimeout(() => (index = next), cues[index]!.ms)
    return () => clearTimeout(timer)
  })

  const onPace = (next: string) => {
    if (next === "slow" || next === "fast") {
      index = 0
      pace = next
    }
  }
</script>

<div class={["flex flex-col gap-2", className]}>
  <!-- A dusk sky over dark hills, so the subtitles sit on something like a video in either theme. Words light up on
       hover as on a video, and cannot be selected, like there. -->
  <div
    class="relative aspect-video w-full overflow-hidden rounded-lg border bg-[linear-gradient(to_bottom,#1e293b,#475569_55%,#1f2937_56%,#111827)] select-none"
    aria-hidden="true"
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
  <Choice
    variant="outline"
    size="sm"
    class="self-center"
    value={pace}
    onPick={onPace}
    aria-label="How quickly the preview's lines change"
  >
    <ToggleGroupItem value="slow">Slow lines</ToggleGroupItem>
    <ToggleGroupItem value="fast">Fast lines</ToggleGroupItem>
  </Choice>
</div>
