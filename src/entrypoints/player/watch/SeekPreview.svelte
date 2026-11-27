<script lang="ts">
  import type { Snippet } from "svelte"
  import type { Previews } from "./previews.svelte"
  import { formatTime } from "./time"

  /** The seek bar, with the frame and time under the pointer shown above it. */
  let {
    duration,
    previews,
    children,
  }: { duration: number; previews: Previews | undefined; children: Snippet } = $props()

  /** How wide the preview is, to keep it inside the bar. */
  const WIDTH_PX = 160

  let bar = $state<HTMLDivElement>()
  /** Where the pointer is over the bar, from 0 at its start to 1 at its end. */
  let share = $state<number>()

  const time = $derived(share === undefined || !Number.isFinite(duration) ? undefined : share * duration)
  const frame = $derived(time === undefined ? undefined : previews?.frameAt(time))
  const left = $derived.by(() => {
    if (share === undefined || bar === undefined) {
      return 0
    }
    const width = bar.clientWidth
    return Math.max(0, Math.min(width - WIDTH_PX, share * width - WIDTH_PX / 2))
  })

  const track = (event: PointerEvent) => {
    if (bar === undefined) {
      return
    }
    const { left, width } = bar.getBoundingClientRect()
    share = width === 0 ? undefined : Math.max(0, Math.min(1, (event.clientX - left) / width))
  }
</script>

<div
  bind:this={bar}
  class="relative flex"
  role="presentation"
  onpointermove={track}
  onpointerleave={() => (share = undefined)}
>
  {#if time !== undefined}
    <div
      class="pointer-events-none absolute bottom-full mb-2 flex flex-col items-center gap-1"
      style:left="{left}px"
      style:width="{WIDTH_PX}px"
    >
      {#if frame !== undefined}
        <img src={frame} alt="" class="w-full rounded-md border border-white/20 bg-black shadow-lg" />
      {/if}
      <span class="rounded bg-black/70 px-1.5 text-sm tabular-nums">{formatTime(time)}</span>
    </div>
  {/if}
  {@render children()}
</div>
