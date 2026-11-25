<script lang="ts">
  import UploadIcon from "@lucide/svelte/icons/upload"
  import PageHeader from "$lib/components/PageHeader.svelte"
  import { Button } from "$lib/components/ui/button"
  import ChooseFiles from "./ChooseFiles.svelte"

  /** Where a video and its subtitles are dropped or chosen, before anything plays. */
  let {
    onFiles,
    subtitles,
    problem,
  }: {
    onFiles: (files: Iterable<File>) => void
    /** The subtitle file chosen while no video is. */
    subtitles: string | undefined
    problem: string | undefined
  } = $props()
</script>

<div class="flex min-h-dvh flex-col">
  <PageHeader class="max-w-2xl" />
  <main class="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-6 pb-24">
    <div
      class="border-border flex w-full flex-col items-center gap-4 rounded-xl border-2 border-dashed px-6 py-16 text-center"
    >
      <UploadIcon class="text-muted-foreground size-10" />
      <div class="flex flex-col gap-1">
        <h1 class="text-xl font-semibold">Drop a video and its subtitles</h1>
        <p class="text-muted-foreground text-sm">
          SRT, WebVTT or ASS subtitles, with words you can click to look up. Nothing leaves your computer.
        </p>
      </div>
      <ChooseFiles {onFiles}>
        {#snippet button(choose)}
          <Button size="lg" onclick={choose}>Choose files</Button>
        {/snippet}
      </ChooseFiles>
      {#if subtitles !== undefined}
        <p class="text-sm">Subtitles: <span class="font-medium">{subtitles}</span>. Now add the video.</p>
      {/if}
    </div>
    {#if problem !== undefined}
      <p class="text-destructive text-sm" role="alert">{problem}</p>
    {/if}
  </main>
</div>
