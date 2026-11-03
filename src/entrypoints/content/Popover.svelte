<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import Play from "@lucide/svelte/icons/play";
  import {
    entriesForLemma,
    groupEntries,
    isAllowedAudioUrl,
    linkSense,
  } from "$lib/dict/entries";
  import type { DictError } from "$lib/dict/errors";
  import type { LookupReply } from "$lib/messages";
  import type { AnchorRect } from "./pick";
  import { placePopover } from "./position";

  let {
    word,
    anchor,
    dark,
    search,
    follow,
  }: {
    word: string;
    anchor: AnchorRect;
    dark: boolean;
    /** Unset when `word` cannot be looked up. A language pins that language for this page. */
    search:
      | ((language?: string, target?: string) => Promise<LookupReply>)
      | undefined;
    /** Look up a `see` word in `language`, without pinning it for this page. */
    follow: (
      target: string,
      language: string | undefined,
    ) => Promise<LookupReply>;
  } = $props();

  /** `followed` shows only the entries whose lemma is `word`. `scrollTop` is where Back left it. */
  type View = {
    word: string;
    followed: boolean;
    reply: Promise<LookupReply> | undefined;
    scrollTop?: number;
  };

  let view = $state.raw<View>(
    untrack(() => ({ word, followed: false, reply: search?.() })),
  );
  let history = $state.raw<Array<View>>([]);
  let scroller: HTMLElement | undefined;

  let element = $state<HTMLElement>();
  let place = $state({ top: 0, left: 0 });
  let failedAudio = $state<string>();
  let player: HTMLAudioElement | undefined;

  const reposition = () => {
    if (element === undefined) {
      return;
    }
    const root = document.scrollingElement;
    place = placePopover(
      anchor,
      { width: element.offsetWidth, height: element.offsetHeight },
      {
        width: root?.clientWidth ?? window.innerWidth,
        height: root?.clientHeight ?? window.innerHeight,
      },
    );
  };

  $effect(() => {
    if (element === undefined) {
      return;
    }
    const observer = new ResizeObserver(reposition);
    observer.observe(element);
    window.addEventListener("resize", reposition);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", reposition);
    };
  });

  // Runs before the rendered reply is in the document, where setting a scroll position does nothing.
  const restoreScroll = (target: HTMLElement) => {
    scroller = target;
    const top = untrack(() => view.scrollTop);
    if (top !== undefined) {
      const frame = requestAnimationFrame(() => {
        target.scrollTop = top;
      });
      return () => cancelAnimationFrame(frame);
    }
  };

  const followLink = (target: string, language: string | undefined) => {
    history = [...history, { ...view, scrollTop: scroller?.scrollTop }];
    view = { word: target, followed: true, reply: follow(target, language) };
  };

  const goBack = () => {
    view = history.at(-1) ?? view;
    history = history.slice(0, -1);
  };

  const switchLanguage = (language: string) => {
    view = {
      ...view,
      reply: search?.(language, view.word),
      scrollTop: undefined,
    };
  };

  const shownEntries = (result: LookupReply) => {
    if (!result.ok) {
      return [];
    }
    return view.followed
      ? entriesForLemma(result.entries, view.word)
      : result.entries;
  };

  const play = (url: string) => {
    player?.pause();
    failedAudio = undefined;
    const next = new Audio(url);
    player = next;
    void next.play().catch(() => {
      if (player === next) {
        failedAudio = url;
      }
    });
  };

  onDestroy(() => {
    player?.pause();
    player = undefined;
  });

  const errorText = (error: DictError): string => {
    switch (error.kind) {
      case "no-server":
        return "No dictionary server is set up. Click the extension icon to add one.";
      case "network":
        return "Could not reach the dictionary server.";
      case "http":
        return "The dictionary server returned an error.";
      case "bad-request":
        return "The dictionary server rejected this request.";
      case "unsupported-lang":
        return "The dictionary server does not support this language.";
      default:
        return "The dictionary server sent an unexpected response.";
    }
  };
</script>

{#snippet seeLink(text: string, target: string, language: string | undefined)}
  <!-- A button would stay one box, which pushes a long link onto its own line. -->
  <a
    href="#see"
    class="underline underline-offset-2"
    onclick={(event) => {
      event.preventDefault();
      followLink(target, language);
    }}>{text}</a
  >
{/snippet}

<div
  bind:this={element}
  class={[
    "dict-popover bg-popover text-popover-foreground fixed flex flex-col rounded-lg border font-sans text-sm shadow-lg",
    dark && "dark",
  ]}
  style:top="{place.top}px"
  style:left="{place.left}px"
  role="dialog"
  aria-label="Dictionary lookup"
>
  {#if history.length > 0}
    <div class="flex border-b p-2">
      <button
        type="button"
        class="hover:bg-muted inline-flex h-6 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium"
        onclick={goBack}
      >
        <ArrowLeft class="size-3" />
        Back
      </button>
    </div>
  {/if}
  {#if view.reply === undefined}
    <p class="text-muted-foreground p-3">
      {view.word === ""
        ? "No word found here. Select one and try again."
        : "That selection is too long. Select a word or a short phrase."}
    </p>
  {:else}
    <!-- Every view gets its own scroller, starting from its own position. -->
    {#key view}
      {#await view.reply}
        <p class="text-muted-foreground p-3" role="status">
          Looking up {view.word}…
        </p>
      {:then result}
        {@const entries = shownEntries(result)}
        {#if result.languages.length > 1}
          <div class="flex flex-wrap gap-1 border-b p-2">
            {#each result.languages as language (language)}
              {@const active = result.ok && result.lang === language}
              <button
                type="button"
                class={[
                  "hover:bg-muted h-6 cursor-pointer rounded-md px-2 text-xs font-medium",
                  active && "bg-secondary text-secondary-foreground",
                ]}
                aria-pressed={active}
                onclick={() => switchLanguage(language)}
              >
                {language}
              </button>
            {/each}
          </div>
        {/if}
        {#if !result.ok}
          <p class="text-destructive p-3 wrap-anywhere" role="alert">
            {errorText(result.error)}
          </p>
        {:else if entries.length === 0}
          <p class="text-muted-foreground p-3 wrap-anywhere">
            No entries for {view.word}.
          </p>
        {:else}
          <div
            {@attach restoreScroll}
            data-popover-scroll
            class="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain p-3"
          >
            {#each groupEntries(entries) as group, index (index)}
              {@const audio = group.audio.find(isAllowedAudioUrl)}
              <section class="flex flex-col gap-1">
                <div class="flex items-center gap-2">
                  <h2 class="min-w-0 text-base font-semibold wrap-anywhere">
                    {group.lemma}
                  </h2>
                  <span class="text-muted-foreground shrink-0 text-xs"
                    >{group.pos}</span
                  >
                  {#if audio !== undefined}
                    <button
                      type="button"
                      class="hover:bg-muted ml-auto inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md disabled:cursor-default disabled:opacity-50"
                      aria-label="Play pronunciation of {group.lemma}"
                      title={failedAudio === audio
                        ? "Could not play this audio"
                        : "Play pronunciation"}
                      disabled={failedAudio === audio}
                      onclick={() => play(audio)}
                    >
                      <Play class="size-3" />
                    </button>
                  {/if}
                </div>
                {#if group.readings.length > 0}
                  <p class="wrap-anywhere">{group.readings.join(", ")}</p>
                {/if}
                {#if group.ipa.length > 0}
                  <p class="text-muted-foreground text-xs wrap-anywhere">
                    {group.ipa.join(" ")}
                  </p>
                {/if}
                <ol class="flex list-decimal flex-col gap-1 pl-5">
                  {#each group.senses as sense, senseIndex (senseIndex)}
                    {@const linked = linkSense(
                      sense.translations.join("; "),
                      sense.see ?? [],
                    )}
                    <li class="wrap-anywhere">
                      {#each linked.parts as part, partIndex (partIndex)}{#if part.target === undefined}{part.text}{:else}{@render seeLink(
                            part.text,
                            part.target,
                            result.lang,
                          )}{/if}{/each}{#if linked.unfound.length > 0}; see {#each linked.unfound as target, targetIndex (target)}{targetIndex >
                          0
                            ? ", "
                            : ""}{@render seeLink(
                            target,
                            target,
                            result.lang,
                          )}{/each}{/if}
                    </li>
                  {/each}
                </ol>
              </section>
            {/each}
          </div>
        {/if}
      {/await}
    {/key}
  {/if}
</div>
