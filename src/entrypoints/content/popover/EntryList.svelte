<script lang="ts">
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right"
  import Play from "@lucide/svelte/icons/play"
  import VolumeX from "@lucide/svelte/icons/volume-x"
  import { isAllowedAudioUrl, linkSense } from "$lib/dict/entries"
  import type { LookupEntry } from "$lib/dict/types"
  import type { AudioPlayer } from "./audio.svelte"
  import { splitStress, stressedLetter } from "./stress"

  let {
    entries,
    language,
    server,
    showIpa,
    audio,
    follow,
  }: {
    entries: Array<LookupEntry>
    /** The language `entries` are in, which a `see` link is looked up in. */
    language: string | undefined
    /** The server that sent `entries`, whose own host may serve their audio. */
    server: string | undefined
    showIpa: boolean
    audio: AudioPlayer
    follow: (target: string, language: string | undefined) => void
  } = $props()
</script>

{#each entries as entry, index (index)}
  {@const url = entry.pron?.audio?.find((link) => isAllowedAudioUrl(link, server))}
  {@const ipa = entry.pron?.ipa ?? []}
  <section class="flex flex-col gap-1.5" data-audio={url}>
    <div class="flex flex-col">
      <div class="flex items-start gap-2">
        <!-- Inline, so the tags follow a long headword onto its last line. -->
        <div class="min-w-0 flex-1 leading-6 wrap-anywhere">
          <h2 class="inline text-base font-semibold">
            {@render stressed(entry.lemma)}
          </h2>
          {" "}<span class="text-muted-foreground text-xs">{entry.pos}</span
          >{#each entry.labels ?? [] as label (label)}{" "}<span
              class="bg-muted text-muted-foreground rounded px-1 text-xs whitespace-nowrap"
              data-label>{label}</span
            >{/each}
        </div>
        {#if url !== undefined}
          {@const going = audio.playing === url}
          {@const failed = audio.failed === url}
          <button
            type="button"
            class="bg-muted text-foreground hover:bg-accent inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md disabled:cursor-default disabled:opacity-50"
            aria-label={going
              ? `Stop pronunciation of ${entry.lemma}`
              : `Play pronunciation of ${entry.lemma}`}
            title={failed ? "Could not play this audio" : going ? "Stop (E)" : "Play pronunciation (E)"}
            disabled={failed}
            onclick={() => audio.play(url)}
          >
            {#if failed}
              <VolumeX class="size-3" />
            {:else if going}
              <span class="dict-playing" aria-hidden="true"><span></span><span></span><span></span></span>
            {:else}
              <Play class="size-3" />
            {/if}
          </button>
        {/if}
      </div>
      <!-- Kana words often come with themselves as the reading. -->
      {#if entry.pron?.reading !== undefined && entry.pron.reading !== entry.lemma}
        <p class="wrap-anywhere">{@render stressed(entry.pron.reading)}</p>
      {/if}
      {#if showIpa && ipa.length > 0}
        <p class="text-muted-foreground text-xs wrap-anywhere">
          {ipa.join(" ")}
        </p>
      {/if}
    </div>
    <ol class="flex list-decimal flex-col gap-1 pl-5">
      {#each entry.senses as sense, senseIndex (senseIndex)}
        {@const linked = linkSense(sense.translations.join("; "), sense.see ?? [])}
        <li class="wrap-anywhere">
          {#each linked.parts as part, partIndex (partIndex)}{#if part.target === undefined}{part.text}{:else}{@render seeLink(
                part.text,
                part.target,
                language,
              )}{/if}{/each}{#if linked.unfound.length > 0}; see {#each linked.unfound as target, targetIndex (target)}{targetIndex >
              0
                ? ", "
                : ""}{@render seeLink(target, target, language)}{/each}{/if}
        </li>
      {/each}
    </ol>
  </section>
{/each}

{#snippet stressed(text: string)}
  {#each splitStress(text) as part, partIndex (partIndex)}{#if part.stressed}{@const letter = stressedLetter(
        part.text,
      )}<span class="dict-stress" data-lift={letter.lift}>{letter.text}</span>{:else}{part.text}{/if}{/each}
{/snippet}

{#snippet seeLink(text: string, target: string, language: string | undefined)}
  <!-- Not a button, which would stay one box and push a long link onto its own line.
       Not an anchor, because Zen opens Alt + click on any anchor in its Glance overlay before the page sees the click. -->
  <span
    role="link"
    tabindex="0"
    class="cursor-pointer underline underline-offset-2"
    onclick={() => follow(target, language)}
    onkeydown={(event) => {
      if (event.key === "Enter") {
        event.preventDefault()
        follow(target, language)
      }
    }}
    >{text}<!-- The word joiner keeps the icon on the same line as the last letter. -->&#x2060;<ArrowUpRight
      class="ml-px inline size-2.5 align-text-top opacity-60"
      aria-hidden="true"
    /></span
  >
{/snippet}
