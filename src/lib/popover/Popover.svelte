<script lang="ts">
  import { onDestroy, untrack } from "svelte"
  import type { Keeping, KeepState } from "$lib/anki/keep"
  import type { LookupEntry } from "$lib/dict/types"
  import { sourceLinks, type SourceLink } from "$lib/dict/sources"
  import type { LookupReply } from "$lib/messages"
  import type { MarkStyle } from "$lib/storage"
  import type { AnchorRect } from "../page/pick"
  import { AudioPlayer } from "$lib/popover/audio.svelte"
  import BackBar from "$lib/popover/BackBar.svelte"
  import EntryList from "$lib/popover/EntryList.svelte"
  import { listenForKeys } from "./keyboard"
  import LanguageBar from "$lib/popover/LanguageBar.svelte"
  import { placePopover, type Side } from "./position"
  import { highlightRanges, type Paint } from "./highlight"
  import {
    errorText,
    pausedText,
    shownEntries,
    shownLanguage,
    shownSplit,
    steppedTab,
    wholeOnTop,
    type Split,
  } from "./reply"
  import SegmentTabs from "./SegmentTabs.svelte"
  import SourceList from "$lib/popover/SourceList.svelte"
  import SourcesButton from "$lib/popover/SourcesButton.svelte"

  let {
    word,
    anchor,
    dark,
    showIpa,
    markStyle,
    highlight,
    marks,
    search,
    follow,
    shown,
    paint = highlightRanges,
    keeping,
  }: {
    word: string
    anchor: AnchorRect
    dark: boolean
    showIpa: boolean
    markStyle: MarkStyle
    /** Covers the looked-up word. `dark` is the page behind it, which picks the colour that shows up there. */
    highlight: { range: Range; dark: boolean } | undefined
    /** Finds the parts of the sentence a context entry's `match` names, to mark instead. */
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
    /** Called with each reply once it is the one on screen, cached or not. */
    shown: (word: string, reply: LookupReply) => void
    /** Marks the word and the sentence's matched parts. Text the extension draws itself marks them its own way. */
    paint?: Paint
    /** Keeping entries for Anki, while it is on. */
    keeping?: Keeping
  } = $props()

  /**
   * `followed` shows only the entries whose lemma is `word`. `scrollTop` and `tab` are where Back left it.
   * `sources` shows those links instead of the entries.
   */
  type View = {
    word: string
    followed: boolean
    reply: Promise<LookupReply> | undefined
    scrollTop?: number
    tab?: number
    sources?: Array<SourceLink>
  }

  let view = $state.raw<View>(untrack(() => ({ word, followed: false, reply: search?.() })))
  let history = $state.raw<Array<View>>([])
  /** The split word's tab picked in this view. Kept out of `view`, which would rebuild the reply on every pick. */
  let tab = $state<number>()
  /** The shown view's split word, for A and D. The template splits the reply it renders on its own. */
  let keySplit = $state.raw<Split>()
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
  $effect(() => {
    if (matched.length > 0 && marks !== undefined) {
      return paint(matched, markStyle, marks.dark)
    }
    return highlight === undefined ? undefined : paint([highlight.range], markStyle, highlight.dark)
  })
  /** Lemma → whether it is kept or in Anki, for the shown reply. */
  let keepStates = $state.raw<Record<string, KeepState>>({})

  const loadKeepStates = (result: LookupReply, target: string, followed: boolean) => {
    if (keeping === undefined || !result.ok || result.lang === undefined) {
      return Promise.resolve({})
    }
    const lemmas = [...new Set(shownEntries(result, target, followed).map((entry) => entry.lemma))]
    return keeping.states(result.lang, lemmas)
  }

  /** Counts the reads of `keepStates`, so an older one that lands late does not replace a newer one. */
  let keepReads = 0

  $effect(() => {
    const { reply, word: target, followed } = view
    keepStates = {}
    const read = ++keepReads
    void reply?.then(async (result) => {
      const states = await loadKeepStates(result, target, followed)
      if (read === keepReads) {
        keepStates = states
      }
    })
  })

  const toggleKeep = async (result: LookupReply, entries: Array<LookupEntry>, entry: number) => {
    if (keeping === undefined || !result.ok || result.lang === undefined || result.server === undefined) {
      return
    }
    const shownView = view
    await keeping.toggle({
      word: shownView.word,
      followed: shownView.followed,
      lang: result.lang,
      server: result.server,
      entries,
      entry,
    })
    const read = ++keepReads
    const states = await loadKeepStates(result, shownView.word, shownView.followed)
    if (read === keepReads) {
      keepStates = states
    }
  }

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
  /** Bound languages from the last reply. */
  let languages = $state.raw<Array<string>>([])
  /** The language the footer marks: the one being looked up, then the one that answered. */
  let footerLanguage = $state<string>()
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

  const openSources = (links: Array<SourceLink>) => {
    lockPlace()
    history = [...history, { ...view, scrollTop: scroller?.scrollTop, tab }]
    view = { ...view, scrollTop: undefined, sources: links }
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
    footerLanguage = target
    tab = undefined
    view = {
      ...view,
      reply: search?.(target, view.word),
      scrollTop: undefined,
    }
  }

  // Only while this view is up, since a replaced view's reply can land after the new one's.
  $effect(() => {
    const { word: target, reply } = view
    let current = true
    void reply?.then((result) => {
      if (current) {
        shown(target, result)
      }
    })
    return () => {
      current = false
    }
  })

  $effect(() => {
    const reply = view.reply
    void reply?.then((result) => {
      if (view.reply !== reply) {
        return
      }
      languages = result.languages
      footerLanguage = shownLanguage(result)
    })
  })

  $effect(() => {
    const { reply, word: target, followed } = view
    keySplit = undefined
    let current = true
    void reply?.then((result) => {
      if (current) {
        keySplit = shownSplit(result, target, followed, marks?.offsetIn)
      }
    })
    return () => {
      current = false
    }
  })

  /** Wraps around, skipping parts without entries. */
  const stepSegment = (step: 1 | -1): boolean => {
    if (keySplit === undefined || view.sources !== undefined) {
      return false
    }
    const next = steppedTab(keySplit, tab ?? keySplit.opens, step)
    if (next === undefined) {
      return false
    }
    pickTab(next)
    return true
  }

  $effect(() =>
    listenForKeys({ scroller: shownScroller, stepSegment, play: audio.play, keeps: keeping !== undefined }),
  )
</script>

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
    <BackBar back={goBack} />
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
        {@const shownTab = split === undefined ? undefined : (tab ?? split.opens)}
        {#if view.sources !== undefined}
          <div
            {@attach restoreScroll}
            data-popover-scroll
            class="flex min-h-0 flex-col overflow-y-auto overscroll-contain px-3 py-2"
          >
            <SourceList links={view.sources} />
          </div>
        {:else if !result.ok}
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
          {@const links = sourceLinks(tabEntries, result.sources, result.lang)}
          {#if split !== undefined && shownTab !== undefined}
            <SegmentTabs {split} tab={shownTab} pick={pickTab} />
          {/if}
          <div
            {@attach restoreScroll}
            data-popover-scroll
            role={split === undefined ? undefined : "tabpanel"}
            class="flex min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain px-3 py-2"
          >
            <div class="relative flex flex-col gap-2">
              <EntryList
                entries={tabEntries}
                language={result.lang}
                server={result.server}
                labels={result.labels}
                {showIpa}
                {audio}
                follow={followLink}
                reserveEnd={links.length > 0}
                whole={split === undefined || shownTab === undefined ? 0 : wholeOnTop(split, shownTab)}
                keep={keeping === undefined
                  ? undefined
                  : {
                      state: (entry) =>
                        Object.hasOwn(keepStates, entry.lemma) ? keepStates[entry.lemma] : undefined,
                      toggle: (listed, index) => void toggleKeep(result, listed, index),
                    }}
              />
              {#if links.length > 0}
                <SourcesButton open={() => openSources(links)} />
              {/if}
            </div>
          </div>
        {/if}
      {/await}
    {/key}
    <!-- Outside the view, so it stays while another language loads and scrolls from where it was. -->
    {#if languages.length > 1 && view.sources === undefined}
      <LanguageBar {languages} shown={footerLanguage} pick={switchLanguage} />
    {/if}
  {/if}
</div>
