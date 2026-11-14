<script lang="ts">
  import { onDestroy, untrack } from "svelte"
  import ArrowLeft from "@lucide/svelte/icons/arrow-left"
  import { sourceLinks } from "$lib/dict/sources"
  import type { LookupReply } from "$lib/messages"
  import type { AnchorRect } from "../page/pick"
  import { AudioPlayer } from "./audio.svelte"
  import EntryList from "./EntryList.svelte"
  import { listenForKeys } from "./keyboard"
  import LanguageBar from "./LanguageBar.svelte"
  import { placePopover, type Side } from "./position"
  import { errorText, firstTab, pausedText, shownEntries, shownLanguage, shownSplit } from "./reply"
  import SegmentTabs from "./SegmentTabs.svelte"
  import Sources from "./Sources.svelte"
  import Underlines from "./Underlines.svelte"

  let {
    word,
    anchor,
    dark,
    showIpa,
    underline,
    marks,
    search,
    follow,
  }: {
    word: string
    anchor: AnchorRect
    dark: boolean
    showIpa: boolean
    /** Covers the looked-up word. `dark` is the page behind it, which picks the accent that shows up there. */
    underline: { range: Range; dark: boolean } | undefined
    /** Finds the parts of the sentence a context entry's `match` names, to underline instead. */
    marks:
      | {
          rangesOf: (match: ReadonlyArray<string>) => Array<Range>
          /** Where `word` starts inside the copy of a part of the sentence that covers it. */
          offsetIn: (part: string) => number | undefined
          dark: boolean
        }
      | undefined
    /** Unset when `word` cannot be looked up. A language becomes the default for the rest of this page. */
    search: ((language?: string, target?: string) => Promise<LookupReply>) | undefined
    /** Look up a `see` word in `language`. */
    follow: (target: string, language: string | undefined) => Promise<LookupReply>
  } = $props()

  /** `followed` shows only the entries whose lemma is `word`. `scrollTop` and `tab` are where Back left it. */
  type View = {
    word: string
    followed: boolean
    reply: Promise<LookupReply> | undefined
    scrollTop?: number
    tab?: number
  }

  let view = $state.raw<View>(untrack(() => ({ word, followed: false, reply: search?.() })))
  let history = $state.raw<Array<View>>([])
  /** The split word's tab picked in this view. Kept out of `view`, which would rebuild the reply on every pick. */
  let tab = $state<number>()
  /** The parts of the sentence the first context entry covers, while the looked-up word is shown. */
  let matched = $state.raw<Array<Range>>([])

  $effect(() => {
    const { reply, followed } = view
    matched = []
    if (reply === undefined || followed || marks === undefined) {
      return
    }
    let current = true
    void reply.then((result) => {
      const match = result.ok ? result.entries.find((entry) => entry.match !== undefined)?.match : undefined
      if (current && match !== undefined) {
        matched = marks.rangesOf(match)
      }
    })
    return () => {
      current = false
    }
  })
  let scroller: HTMLElement | undefined
  const shownScroller = (): HTMLElement | undefined => (scroller?.isConnected ? scroller : undefined)

  let element = $state<HTMLElement>()
  let place = $state<{ top: number; left: number; side: Side; maxHeight?: number }>({
    top: 0,
    left: 0,
    side: "below",
  })
  /** Set once the content would scroll at the normal width. It stays set, so the popover does not jump back. */
  let wide = $state(false)
  /** Set by the first followed link, so the popover no longer moves away from the cursor. It only grows from then on. */
  let lock = $state<{ side: Side; minHeight: number }>()
  /** Bound languages from the last reply, and the one shown or being looked up. */
  let languages = $state.raw<Array<string>>([])
  let language = $state<string>()
  const audio = new AudioPlayer()
  onDestroy(audio.stop)

  const reposition = () => {
    if (element === undefined) {
      return
    }
    const root = document.scrollingElement
    const content = shownScroller()
    // Only the scroller shrinks under the cap, so what it hides is what the popover would grow by.
    const height =
      element.offsetHeight + (content === undefined ? 0 : content.scrollHeight - content.clientHeight)
    place = placePopover(
      anchor,
      { width: element.offsetWidth, height: Math.max(height, lock?.minHeight ?? 0) },
      {
        width: root?.clientWidth ?? window.innerWidth,
        height: root?.clientHeight ?? window.innerHeight,
      },
      lock?.side,
    )
    if (place.maxHeight !== undefined && height > place.maxHeight) {
      wide = true
    }
    // Back can shrink the content, and Back sits where the cursor is.
    if (lock !== undefined && element.offsetHeight > lock.minHeight) {
      lock = { ...lock, minHeight: element.offsetHeight }
    }
  }

  $effect(() => {
    if (element === undefined) {
      return
    }
    const observer = new ResizeObserver(reposition)
    observer.observe(element)
    window.addEventListener("resize", reposition)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", reposition)
    }
  })

  // Runs before the rendered reply is in the document, where setting a scroll position does nothing.
  const restoreScroll = (target: HTMLElement) => {
    scroller = target
    const top = untrack(() => view.scrollTop)
    if (top !== undefined) {
      const frame = requestAnimationFrame(() => {
        target.scrollTop = top
      })
      return () => cancelAnimationFrame(frame)
    }
  }

  /** Stops the popover moving away from the cursor once the content starts changing under it. */
  const lockPlace = () => {
    lock ??= { side: place.side, minHeight: element?.offsetHeight ?? 0 }
  }

  const followLink = (target: string, language: string | undefined) => {
    lockPlace()
    history = [...history, { ...view, scrollTop: scroller?.scrollTop, tab }]
    view = { word: target, followed: true, reply: follow(target, language) }
    tab = undefined
  }

  const pickTab = (next: number) => {
    lockPlace()
    tab = next
    const target = shownScroller()
    if (target !== undefined) {
      target.scrollTop = 0
    }
  }

  const goBack = () => {
    view = history.at(-1) ?? view
    tab = view.tab
    history = history.slice(0, -1)
  }

  const switchLanguage = (target: string) => {
    language = target
    tab = undefined
    view = {
      ...view,
      reply: search?.(target, view.word),
      scrollTop: undefined,
    }
  }

  $effect(() => {
    const reply = view.reply
    void reply?.then((result) => {
      if (view.reply !== reply) {
        return
      }
      languages = result.languages
      language = shownLanguage(result) ?? language
    })
  })

  /** Wraps around. Without a current language, D starts at the first and A at the last. */
  const stepLanguage = (step: 1 | -1): boolean => {
    if (search === undefined || languages.length < 2) {
      return false
    }
    const index = language === undefined ? -1 : languages.indexOf(language)
    const next =
      index === -1
        ? step === 1
          ? 0
          : languages.length - 1
        : (index + step + languages.length) % languages.length
    switchLanguage(languages[next]!)
    return true
  }

  $effect(() => listenForKeys({ scroller: shownScroller, stepLanguage, play: audio.play }))
</script>

{#if matched.length > 0 && marks !== undefined}
  <Underlines ranges={matched} dark={marks.dark} />
{:else if underline !== undefined}
  <Underlines ranges={[underline.range]} dark={underline.dark} />
{/if}

<div
  bind:this={element}
  class={[
    "dict-popover bg-popover text-popover-foreground fixed flex flex-col rounded-lg border font-sans text-sm shadow-lg",
    dark && "dark",
    wide && "wide",
  ]}
  style:top="{place.top}px"
  style:left="{place.left}px"
  style:max-height={place.maxHeight === undefined ? undefined : `${place.maxHeight}px`}
  style:min-height={lock === undefined || place.maxHeight === undefined
    ? undefined
    : `${Math.min(lock.minHeight, place.maxHeight)}px`}
  role="dialog"
  aria-label="Dictionary lookup"
>
  {#if history.length > 0}
    <div class="flex border-b p-2">
      <button
        type="button"
        class="hover:bg-accent inline-flex h-6 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium"
        onclick={goBack}
      >
        <ArrowLeft class="size-3" />
        Back
      </button>
    </div>
  {/if}
  {#if view.reply === undefined}
    <p class="text-muted-foreground px-3 py-2">
      {view.word === ""
        ? "No word found here. Select one and try again."
        : "That selection is too long. Select a word or a short phrase."}
    </p>
  {:else}
    <!-- Every view gets its own scroller, starting from its own position. -->
    {#key view}
      {#await view.reply}
        <p class="text-muted-foreground px-3 py-2" role="status">
          Looking up {view.word}…
        </p>
      {:then result}
        {@const entries = shownEntries(result, view.word, view.followed)}
        {@const shown = shownLanguage(result)}
        {@const split = shownSplit(result, view.word, view.followed, marks?.offsetIn)}
        {@const shownTab = split === undefined ? undefined : (tab ?? firstTab(split))}
        {#if !result.ok}
          <p class="text-destructive px-3 py-2 wrap-anywhere" role="alert">
            {errorText(result.error)}
          </p>
        {:else if entries.length === 0}
          <p class="text-muted-foreground px-3 py-2 wrap-anywhere">
            No entries for {view.word}{shown === undefined ? "" : ` in ${shown}`}.
          </p>
          {#if result.paused.length > 0}
            <p class="text-muted-foreground px-3 pb-2 wrap-anywhere">
              {pausedText(result.paused)}
            </p>
          {/if}
        {:else}
          {@const tabEntries =
            split === undefined || shownTab === undefined ? entries : (split.parts[shownTab]?.entries ?? [])}
          {@const links = sourceLinks(tabEntries, result.sources, result.lang, result.server)}
          {#if split !== undefined && shownTab !== undefined}
            <SegmentTabs {split} tab={shownTab} pick={pickTab} />
          {/if}
          <div
            {@attach restoreScroll}
            data-popover-scroll
            role={split === undefined ? undefined : "tabpanel"}
            class="flex min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain px-3 py-2"
          >
            <EntryList
              entries={tabEntries}
              language={result.lang}
              server={result.server}
              labels={result.labels}
              {showIpa}
              {audio}
              follow={followLink}
            />
            {#if links.length > 0}
              <Sources {links} />
            {/if}
          </div>
        {/if}
        {#if result.languages.length > 1}
          <LanguageBar languages={result.languages} {shown} pick={switchLanguage} />
        {/if}
      {/await}
    {/key}
  {/if}
</div>
