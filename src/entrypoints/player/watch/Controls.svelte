<script lang="ts">
  import MaximizeIcon from "@lucide/svelte/icons/maximize"
  import MinimizeIcon from "@lucide/svelte/icons/minimize"
  import PauseIcon from "@lucide/svelte/icons/pause"
  import PlayIcon from "@lucide/svelte/icons/play"
  import Volume2Icon from "@lucide/svelte/icons/volume-2"
  import VolumeXIcon from "@lucide/svelte/icons/volume-x"
  import type { FileTrack } from "../open/subtitles"
  import SubtitleMenu from "./SubtitleMenu.svelte"
  import { formatTime } from "./time"
  import { keepFocus } from "./keys"

  /** The bar under the video: playing, seeking, sound, subtitles and fullscreen. */
  let {
    currentTime = $bindable(),
    volume = $bindable(),
    muted = $bindable(),
    paused,
    duration,
    fullscreen,
    track,
    subtitleFiles,
    hidden,
    onToggle,
    onFullscreen,
    onFiles,
    onPickSubtitles,
  }: {
    currentTime: number
    volume: number
    muted: boolean
    paused: boolean
    duration: number
    fullscreen: boolean
    track: FileTrack | undefined
    subtitleFiles: ReadonlyArray<File>
    /** Faded out while the video plays and the pointer rests. */
    hidden: boolean
    onToggle: () => void
    onFullscreen: () => void
    onFiles: (files: Iterable<File>) => void
    onPickSubtitles: (file: File) => void
  } = $props()

  const button =
    "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-white/15"
</script>

<div
  class="pointer-events-none absolute inset-x-0 bottom-0 z-50 bg-linear-to-t from-black/80 to-transparent pt-10 text-white transition-opacity duration-300"
  class:opacity-0={hidden}
>
  <!-- Only the controls take the pointer. The shade above them is over the subtitles' lower half. -->
  <div data-controls class="flex flex-col gap-1 px-4 pb-3" class:pointer-events-auto={!hidden}>
    <input
      type="range"
      aria-label="Seek"
      min="0"
      max={Number.isFinite(duration) ? duration : 0}
      step="any"
      bind:value={currentTime}
      class="w-full cursor-pointer accent-white"
    />
    <div class="flex items-center gap-1">
      <button
        type="button"
        class={button}
        aria-label={paused ? "Play" : "Pause"}
        onmousedown={keepFocus}
        onclick={onToggle}
      >
        {#if paused}<PlayIcon class="size-5" />{:else}<PauseIcon class="size-5" />{/if}
      </button>
      <button
        type="button"
        class={button}
        aria-label={muted ? "Unmute" : "Mute"}
        onmousedown={keepFocus}
        onclick={() => {
          muted = !muted
        }}
      >
        {#if muted || volume === 0}<VolumeXIcon class="size-5" />{:else}<Volume2Icon class="size-5" />{/if}
      </button>
      <input
        type="range"
        aria-label="Volume"
        min="0"
        max="1"
        step="0.05"
        bind:value={volume}
        class="w-20 cursor-pointer accent-white"
      />
      <span class="ml-2 text-sm tabular-nums">{formatTime(currentTime)} / {formatTime(duration)}</span>
      <div class="flex-1"></div>
      <SubtitleMenu {track} {subtitleFiles} {hidden} {onFiles} {onPickSubtitles} />
      <button
        type="button"
        class={button}
        aria-label={fullscreen ? "Leave fullscreen" : "Fullscreen"}
        onmousedown={keepFocus}
        onclick={onFullscreen}
      >
        {#if fullscreen}<MinimizeIcon class="size-5" />{:else}<MaximizeIcon class="size-5" />{/if}
      </button>
    </div>
  </div>
</div>
