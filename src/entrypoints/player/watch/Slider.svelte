<script lang="ts">
  import type { ClassValue } from "svelte/elements"

  /**
   * A slider for the bar under the video, filled in the active colour up to `filled` over a dim track.
   * The player's keys move what it shows, so it can't be tabbed to and lets go of focus once dragged.
   */
  let {
    value = $bindable(),
    max,
    step,
    label,
    filled,
    class: className,
  }: {
    value: number
    max: number
    step: number | "any"
    label: string
    /** How much of the track is filled, from 0 to 1. The value's share when unset. */
    filled?: number
    class?: ClassValue
  } = $props()

  const fill = $derived(filled ?? (max > 0 ? value / max : 0))
</script>

<!-- Dark, for the colours that read on the video's black whatever the theme. -->
<input
  type="range"
  aria-label={label}
  min="0"
  {max}
  {step}
  bind:value
  tabindex="-1"
  onpointerup={(event) => event.currentTarget.blur()}
  class={["dark slider", className]}
  style:--filled="{fill * 100}%"
/>

<style>
  .slider {
    appearance: none;
    height: 1rem;
    cursor: pointer;
    background: transparent;
  }
  .slider::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 9999px;
    background: linear-gradient(to right, var(--link) var(--filled), rgb(255 255 255 / 0.25) var(--filled));
  }
  .slider::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    margin-top: -4px;
    border-radius: 9999px;
    background: white;
  }
  .slider::-moz-range-track {
    height: 4px;
    border-radius: 9999px;
    background: var(--track);
  }
  .slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border: none;
    border-radius: 9999px;
    background: white;
  }
</style>
