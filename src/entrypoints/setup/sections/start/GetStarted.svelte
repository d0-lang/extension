<script lang="ts">
  import { onMount } from "svelte"
  import { Button } from "$lib/components/ui/button"
  import Keycap from "$lib/components/Keycap.svelte"
  import SectionTitle from "../../layout/SectionTitle.svelte"
  import ServerDialog from "../servers/components/ServerDialog.svelte"
  import { ServerSetup } from "../servers/ServerSetup.svelte"
  import type { StartProgress } from "./progress.svelte"
  import Step from "./Step.svelte"
  import TryIt from "./TryIt.svelte"

  /** The first-run list: add a server, try a sample lookup here, then look up a word on a real page. */
  let { progress }: { progress: StartProgress } = $props()

  const servers = new ServerSetup()
  onMount(() => {
    void servers.load()
    return servers.watch()
  })

  /** Set by the first sample lookup. The step stays open until Next, so the sample can be tried for a while. */
  let triedHere = $state(false)

  const done = $derived([progress.steps[0], progress.steps[1] || triedHere, progress.steps[2]])
  /** The first step not moved past. The sample step is moved past with Next, the others by doing them. */
  const current = $derived(progress.steps.findIndex((step) => !step))
  const finished = $derived(progress.steps.every(Boolean))

  /** Out of the list, to the servers, which a phone shows as the list of sections. */
  const leave = async () => {
    await progress.close()
    location.hash = "#servers"
  }
</script>

<section class="flex max-w-2xl flex-col gap-6">
  <SectionTitle title="Get started">
    {#if !finished}
      <Button variant="ghost" size="sm" class="text-muted-foreground" onclick={() => void leave()}
        >Skip</Button
      >
    {/if}
  </SectionTitle>
  <div class="flex flex-col gap-3">
    <p class="text-muted-foreground text-sm">Three steps. Each ticks itself off when you do it.</p>
    <div
      class="bg-muted h-1 overflow-hidden rounded-full"
      role="progressbar"
      aria-valuenow={progress.done}
      aria-valuemax={3}
    >
      <div
        class="bg-primary h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.3,1.3,0.5,1)] motion-reduce:transition-none"
        style:width="{(done.filter(Boolean).length / 3) * 100}%"
      ></div>
    </div>
  </div>

  <ol class="flex flex-col gap-1">
    <Step title="Add a dictionary server" done={done[0] === true} current={current === 0}>
      <p class="text-muted-foreground text-sm">
        Pick a server and the languages it should answer. DaDict public is there to start with, or use your
        own.
      </p>
      <Button class="self-start" onclick={servers.openAdd}>Add a server</Button>
    </Step>
    <Step title="Try it here" done={done[1] === true} current={current === 1}>
      <p class="text-muted-foreground text-sm">
        Hold <Keycap>Alt</Keycap> and point at a word. On a phone, tap one here. On other pages, long-press it and
        tap <span class="text-foreground">Look up</span>.
      </p>
      <TryIt looked={() => (triedHere = true)} />
      <div class="flex min-h-8 items-center gap-3">
        {#if triedHere}
          <Button class="animate-in fade-in slide-in-from-bottom-1" onclick={() => void progress.tried()}
            >Next</Button
          >
        {:else}
          <p class="text-muted-foreground text-xs">
            Sample answers, so this works whatever languages you picked.
          </p>
        {/if}
      </div>
    </Step>
    <Step title="Look up a word on a real page" done={done[2] === true} current={current === 2}>
      <p class="text-muted-foreground text-sm">
        Open any page in a language you added and do the same. This ticks itself off on your first lookup.
      </p>
    </Step>
  </ol>

  {#if finished}
    <div
      class="bg-link/10 animate-in fade-in slide-in-from-bottom-2 flex flex-wrap items-center justify-between gap-3 rounded-lg p-4"
    >
      <p class="text-sm">
        <span class="font-medium">You're set.</span>
        <span class="text-muted-foreground">Shortcuts and everything else are in the other sections.</span>
      </p>
      <Button onclick={() => void leave()}>Close</Button>
    </div>
  {/if}

  <p class="text-muted-foreground text-sm">
    Also worth a try: <a href="#anki" class="text-foreground underline underline-offset-2"
      >keep words for Anki</a
    >
    with <Keycap>Q</Keycap>, and click a subtitle word on YouTube.
  </p>
</section>

{#if servers.dialogState !== "closed"}
  <ServerDialog setup={servers} />
{/if}
