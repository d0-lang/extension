<script lang="ts">
  import type { ContentScriptContext } from "wxt/utils/content-script-context"
  import type { Lookup } from "$lib/lookup"
  import { matchingFirst, sortFiles } from "./open/files"
  import Picker from "./open/Picker.svelte"
  import Preparing from "./open/Preparing.svelte"
  import { needsRemux, remuxToMp4 } from "./open/remux"
  import { loadSubtitles, problemOf, type FileTrack } from "./open/subtitles"
  import Player from "./watch/Player.svelte"

  let { ctx, lookup }: { ctx: ContentScriptContext; lookup: Lookup } = $props()

  let video = $state<{ url: string; name: string } | undefined>()
  /** Raw, since the controller searches its cues every frame. */
  let track = $state.raw<FileTrack | undefined>()
  let subtitleFiles = $state.raw<ReadonlyArray<File>>([])
  let problem = $state<string | undefined>()
  /** A video being rewrapped before it plays. */
  let preparing = $state<{ name: string; share: number; stop: AbortController } | undefined>()

  const show = (media: Blob, name: string) => {
    if (video !== undefined) {
      URL.revokeObjectURL(video.url)
    }
    video = { url: URL.createObjectURL(media), name }
  }

  /** Plays `file`, rewrapped first when this browser plays it better that way. It plays as it is if that fails. */
  const play = async (file: File) => {
    preparing?.stop.abort()
    if (!needsRemux(file)) {
      show(file, file.name)
      return
    }
    const stop = new AbortController()
    preparing = { name: file.name, share: 0, stop }
    const mp4 = await remuxToMp4(
      file,
      (share) => {
        if (preparing?.stop === stop) {
          preparing.share = share
        }
      },
      stop.signal,
    )
    // A newer file took its place.
    if (preparing?.stop !== stop) {
      return
    }
    preparing = undefined
    show(mp4.unwrapOr(file), file.name)
  }

  const pickSubtitles = async (file: File) => {
    const loaded = await loadSubtitles(file)
    if (loaded.isErr()) {
      problem = problemOf(file.name, loaded.error)
      return
    }
    problem = undefined
    track = loaded.value
  }

  /** Plays the video among `files`, with the subtitles named after it, or swaps in new subtitles. */
  const open = (files: Iterable<File>) => {
    const sorted = sortFiles(files)
    if (sorted.video === undefined && sorted.subtitles.length === 0) {
      problem = "Those are not a video or subtitles."
      return
    }
    problem = undefined
    if (sorted.video !== undefined) {
      void play(sorted.video)
    }
    if (sorted.subtitles.length > 0) {
      subtitleFiles = sorted.subtitles
    }
    const name = sorted.video?.name ?? video?.name
    const [best] = name === undefined ? subtitleFiles : matchingFirst(name, subtitleFiles)
    if (best !== undefined && (sorted.subtitles.length > 0 || track === undefined)) {
      void pickSubtitles(best)
    }
  }
</script>

<svelte:window
  ondragover={(event) => event.preventDefault()}
  ondrop={(event) => {
    event.preventDefault()
    open([...(event.dataTransfer?.files ?? [])])
  }}
/>

{#if preparing !== undefined}
  <Preparing name={preparing.name} share={preparing.share} onSkip={() => preparing?.stop.abort()} />
{:else if video === undefined}
  <Picker onFiles={open} subtitles={track?.name} {problem} />
{:else}
  <Player
    {ctx}
    {lookup}
    {video}
    {track}
    {subtitleFiles}
    onFiles={open}
    onPickSubtitles={(file) => void pickSubtitles(file)}
  />
  {#if problem !== undefined}
    <p
      class="bg-destructive fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-md px-4 py-2 text-sm text-white"
      role="alert"
    >
      {problem}
    </p>
  {/if}
{/if}
