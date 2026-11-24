<script lang="ts">
  import PageHeader from "$lib/components/PageHeader.svelte"
  import { Button } from "$lib/components/ui/button"

  /** Progress while a video is rewrapped to play smoothly, with a way to play it as it is instead. */
  let { name, share, onSkip }: { name: string; share: number; onSkip: () => void } = $props()
</script>

<div class="flex min-h-dvh flex-col">
  <PageHeader class="max-w-2xl" />
  <main
    class="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-6 pb-24 text-center"
  >
    <div class="flex w-full flex-col gap-1">
      <h1 class="truncate text-xl font-semibold" title={name}>Getting {name} ready</h1>
      <p class="text-muted-foreground text-sm">
        Firefox stutters on MKV files, so this one is put in an MP4 file first. The video is copied as it is,
        and nothing leaves your computer.
      </p>
    </div>
    <div class="flex w-full flex-col gap-2">
      <div
        class="bg-muted h-2 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(share * 100)}
      >
        <div class="bg-primary h-full transition-[width]" style:width="{share * 100}%"></div>
      </div>
      <span class="text-muted-foreground text-sm tabular-nums">{Math.round(share * 100)}%</span>
    </div>
    <Button variant="outline" onclick={onSkip}>Play it as it is</Button>
  </main>
</div>
