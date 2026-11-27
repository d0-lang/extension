<script lang="ts">
  import { onMount } from "svelte"
  import type { ContentScriptContext } from "wxt/utils/content-script-context"
  import { Button } from "$lib/components/ui/button"
  import type { Lookup } from "$lib/lookup"
  import type { FileTrack } from "../open/subtitles"
  import ChooseFiles from "../open/ChooseFiles.svelte"
  import Controls from "./Controls.svelte"
  import { actionOf } from "./keys"
  import { getSound, setSound } from "./sound"
  import { showFileSubtitles } from "./subtitles"

  /** A video filling the page, with clickable subtitles over it and the controls under them. */
  let {
    ctx,
    lookup,
    video,
    track,
    subtitleFiles,
    onFiles,
    onPickSubtitles,
  }: {
    ctx: ContentScriptContext
    lookup: Lookup
    video: { url: string; name: string }
    track: FileTrack | undefined
    subtitleFiles: ReadonlyArray<File>
    onFiles: (files: Iterable<File>) => void
    onPickSubtitles: (file: File) => void
  } = $props()

  /** How far the arrow keys skip. */
  const SKIP_SECONDS = 5
  /** How long the pointer rests before the controls fade, while the video plays. */
  const IDLE_MS = 2500

  let box: HTMLDivElement
  let element: HTMLVideoElement
  let paused = $state(true)
  let currentTime = $state(0)
  let duration = $state(0)
  let volume = $state(1)
  let muted = $state(false)
  let fullscreen = $state(false)
  let idle = $state(false)
  let failed = $state(false)
  /** Set once the stored volume is in, so the default it starts at is not saved over it. */
  let soundRead = false
  let idleTimer: ReturnType<typeof setTimeout> | undefined

  onMount(() => {
    const subtitles = showFileSubtitles(ctx, lookup.subtitleOptions, () =>
      track === undefined ? undefined : { player: box, video: element, track, key: video.name },
    )
    lookup.useSubtitles(subtitles)
    subtitles.start()
    void getSound()
      .then((sound) => {
        volume = sound.volume
        muted = sound.muted
      })
      .catch(() => {})
      .finally(() => {
        soundRead = true
      })
  })

  $effect(() => {
    // Read so a new video clears the last one's failure.
    void video.url
    failed = false
  })

  const wake = () => {
    idle = false
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      idle = !paused
    }, IDLE_MS)
  }

  const toggle = () => {
    if (element.paused) {
      void element.play().catch(() => {})
    } else {
      element.pause()
    }
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement === box) {
      void document.exitFullscreen()
    } else {
      void box.requestFullscreen()
    }
  }

  const onKey = (event: KeyboardEvent) => {
    const action = actionOf(event)
    if (action === undefined) {
      return
    }
    event.preventDefault()
    wake()
    switch (action) {
      case "toggle":
        toggle()
        break
      case "back":
        element.currentTime = Math.max(0, element.currentTime - SKIP_SECONDS)
        break
      case "forward":
        element.currentTime = Math.min(element.duration, element.currentTime + SKIP_SECONDS)
        break
      case "fullscreen":
        toggleFullscreen()
        break
      case "mute":
        muted = !muted
        break
    }
  }
</script>

<svelte:window onkeydown={onKey} />
<svelte:document
  onfullscreenchange={() => {
    fullscreen = document.fullscreenElement === box
  }}
/>

<div
  bind:this={box}
  class="relative h-dvh w-full overflow-hidden bg-black"
  class:cursor-none={idle}
  onpointermove={wake}
  role="presentation"
>
  <!-- svelte-ignore a11y_media_has_caption: the subtitles are drawn over it from the chosen file. -->
  <video
    bind:this={element}
    src={video.url}
    class="size-full object-contain"
    autoplay
    bind:paused
    bind:currentTime
    bind:duration
    bind:volume
    bind:muted
    onclick={toggle}
    onplay={wake}
    onpause={() => {
      idle = false
    }}
    onvolumechange={() => {
      if (soundRead) {
        void setSound({ volume: element.volume, muted: element.muted }).catch(() => {})
      }
    }}
    onerror={() => {
      failed = true
    }}
  ></video>
  {#if failed}
    <div class="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white">
      <p>This browser cannot play {video.name}. MP4 and WebM files play everywhere.</p>
      <ChooseFiles {onFiles}>
        {#snippet button(choose)}
          <Button variant="secondary" onclick={choose}>Choose another file</Button>
        {/snippet}
      </ChooseFiles>
    </div>
  {/if}
  <Controls
    bind:currentTime
    bind:volume
    bind:muted
    {paused}
    {duration}
    {fullscreen}
    {track}
    {subtitleFiles}
    hidden={idle}
    onToggle={toggle}
    onFullscreen={toggleFullscreen}
    {onFiles}
    {onPickSubtitles}
  />
</div>
