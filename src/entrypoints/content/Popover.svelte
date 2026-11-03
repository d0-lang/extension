<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import Play from "@lucide/svelte/icons/play";
  import { Kbd } from "$lib/components/ui/kbd";
  import {
    entriesForLemma,
    groupEntries,
    isAllowedAudioUrl,
    linkSense,
  } from "$lib/dict/entries";
  import type { DictError } from "$lib/dict/errors";
  import type { LookupReply } from "$lib/messages";
  import { isTyping } from "./hold";
  import type { AnchorRect } from "./pick";
  import { placePopover, type Side } from "./position";

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
  let place = $state({ top: 0, left: 0, side: "below" as Side, room: 0 });
  /** Set by the first followed link, so the popover no longer moves away from the cursor. It only grows from then on. */
  let lock = $state<{ side: Side; minHeight: number }>();
  /** Bound languages from the last reply, and the one shown or being looked up. */
  let languages = $state.raw<Array<string>>([]);
  let language = $state<string>();
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
      lock?.side,
    );
    // Back can shrink the content, and Back sits where the cursor is.
    if (lock !== undefined && element.offsetHeight > lock.minHeight) {
      lock = { ...lock, minHeight: element.offsetHeight };
    }
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
    lock ??= { side: place.side, minHeight: element?.offsetHeight ?? 0 };
    history = [...history, { ...view, scrollTop: scroller?.scrollTop }];
    view = { word: target, followed: true, reply: follow(target, language) };
  };

  const goBack = () => {
    view = history.at(-1) ?? view;
    history = history.slice(0, -1);
  };

  const switchLanguage = (target: string) => {
    language = target;
    view = {
      ...view,
      reply: search?.(target, view.word),
      scrollTop: undefined,
    };
  };

  /** The language that answered, or the only one asked when it did not. Unset when several were asked and none answered. */
  const shownLanguage = (result: LookupReply): string | undefined =>
    (result.ok ? result.lang : undefined) ??
    (result.tried.length === 1 ? result.tried[0] : undefined);

  $effect(() => {
    const reply = view.reply;
    void reply?.then((result) => {
      if (view.reply !== reply) {
        return;
      }
      languages = result.languages;
      language = shownLanguage(result) ?? language;
    });
  });

  /** Wraps around. Without a current language, D starts at the first and A at the last. */
  const stepLanguage = (step: 1 | -1): boolean => {
    if (search === undefined || languages.length < 2) {
      return false;
    }
    const index = language === undefined ? -1 : languages.indexOf(language);
    const next =
      index === -1
        ? step === 1
          ? 0
          : languages.length - 1
        : (index + step + languages.length) % languages.length;
    switchLanguage(languages[next]!);
    return true;
  };

  // Physical keys, so they stay under the same fingers on any layout.
  const languageSteps: Record<string, 1 | -1> = { KeyA: -1, KeyD: 1 };

  $effect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const step = languageSteps[event.code];
      // Alt stays allowed, because the popover is open while Alt is held.
      if (step === undefined || event.ctrlKey || event.metaKey || event.repeat || isTyping()) {
        return;
      }
      if (stepLanguage(step)) {
        // Pages bind single letters too, like YouTube and Gmail.
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  });

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
  style:--dict-room={lock && `${place.room}px`}
  style:min-height={lock && `${Math.min(lock.minHeight, place.room)}px`}
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
        {@const shown = shownLanguage(result)}
        {#if !result.ok}
          <p class="text-destructive p-3 wrap-anywhere" role="alert">
            {errorText(result.error)}
          </p>
        {:else if entries.length === 0}
          <p class="text-muted-foreground p-3 wrap-anywhere">
            No entries for {view.word}{shown === undefined ? "" : ` in ${shown}`}.
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
        {#if result.languages.length > 1}
          <div class="flex shrink-0 items-center gap-2 border-t p-2">
            <Kbd class="shrink-0" title="Previous language">A</Kbd>
            <div class="flex flex-1 flex-wrap justify-center gap-1" role="group" aria-label="Languages">
              {#each result.languages as code (code)}
                {@const active = shown === code}
                <button
                  type="button"
                  class={[
                    "hover:bg-muted h-6 cursor-pointer rounded-md px-2 text-xs font-medium",
                    active && "bg-secondary text-secondary-foreground",
                  ]}
                  aria-pressed={active}
                  onclick={() => switchLanguage(code)}
                >
                  {code}
                </button>
              {/each}
            </div>
            <Kbd class="shrink-0" title="Next language">D</Kbd>
          </div>
        {/if}
      {/await}
    {/key}
  {/if}
</div>
