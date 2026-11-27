<script lang="ts">
  import { onMount } from "svelte"
  import PageHeader from "$lib/components/PageHeader.svelte"
  import { playableAudio } from "$lib/dict/entries"
  import { getShowIpa } from "$lib/storage"
  import AllSent from "./AllSent.svelte"
  import CardPreview from "./CardPreview.svelte"
  import Editor from "./Editor.svelte"
  import { noteFields } from "./fields"
  import KeyLegend from "./KeyLegend.svelte"
  import { reviewAction } from "./keys"
  import { legendRow, pressedKeys } from "./legend"
  import NoWords from "./NoWords.svelte"
  import { Review } from "./review.svelte"
  import WordList from "./WordList.svelte"

  const review = new Review()
  /** Whether cards get IPA, as the popover shows it. */
  let ipa = $state(true)
  let dark = $state(false)
  let legend = $state<KeyLegend>()
  /** Where the Send button's card was as the last word went, for the finale to fly it from. */
  let lastCard = $state.raw<DOMRect>()

  /**
   * Cards sent from this page, counting one still being sent. The list can empty before the send finishes, and the
   * page should not show "No kept words" in between.
   */
  const sent = $derived(review.sent + (review.sending ? 1 : 0))

  const fields = $derived.by(() => {
    const { current, draft } = review
    if (current === undefined || draft === undefined) {
      return undefined
    }
    return noteFields(current, draft, ipa)
  })

  onMount(() => {
    void getShowIpa().then((shown) => (ipa = shown))
    // `.dark` on the root is the extension's theme, which the preview follows.
    const root = document.documentElement
    dark = root.classList.contains("dark")
    const observer = new MutationObserver(() => (dark = root.classList.contains("dark")))
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    const stop = review.watch()
    return () => {
      observer.disconnect()
      stop()
    }
  })

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    if (target?.closest("input, textarea, [contenteditable]") !== null && target !== null) {
      return
    }
    const action = reviewAction(event)
    if (action === undefined) {
      return
    }
    // A control reached with Tab takes Space and Enter itself. One the mouse left focused does not.
    if (
      action.kind === "activate" &&
      target?.matches("button:focus-visible, [role]:focus-visible") === true
    ) {
      return
    }
    event.preventDefault()
    // A held key repeats, and two drops in a row drop the word, so only a fresh press counts.
    if (event.repeat && (action.kind === "drop" || action.kind === "activate")) {
      return
    }
    const row = legendRow(action, review.focus)
    if (row !== undefined) {
      legend?.flash(row, pressedKeys(event))
    }
    // Only a second drop in a row drops.
    if (action.kind !== "drop") {
      review.dropArmed = false
    }
    switch (action.kind) {
      case "focus":
        review.moveFocus(action.step)
        return
      case "entry":
        review.stepEntry(action.step)
        return
      case "activate":
        review.activate()
        return
      case "edit":
        review.edit()
        return
      case "cancel":
        return
      case "sense":
        review.toggleSense(action.index)
        return
      case "word":
        review.step(action.step)
        return
      case "send":
        void review.send()
        return
      case "drop":
        void review.drop()
        return
    }
  }
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="bg-background min-h-svh">
  <PageHeader class="max-w-6xl" />
  <main class="mx-auto max-w-6xl px-4 py-6 md:px-6">
    {#if !review.loaded}
      <!-- Nothing until storage answers, so the empty state does not flash. -->
    {:else if review.current === undefined || review.draft === undefined || fields === undefined}
      {#if sent > 0}
        <AllSent count={sent} from={lastCard} />
      {:else}
        <NoWords />
      {/if}
    {:else}
      <div
        class="grid grid-cols-[minmax(0,1fr)] items-start gap-6 md:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_minmax(0,24rem)]"
      >
        <aside class="flex flex-col gap-2 max-md:order-last">
          <h1 class="text-muted-foreground px-3 text-sm font-medium">
            {review.seeds.length} kept {review.seeds.length === 1 ? "word" : "words"}
          </h1>
          <WordList seeds={review.seeds} current={review.current.id} show={review.show} />
        </aside>
        <section class="flex min-w-0 flex-col gap-6">
          <Editor
            {review}
            seed={review.current}
            draft={review.draft}
            sentence={fields.Sentence}
            launch={(from) => (lastCard = from)}
          />
          <div class="xl:hidden">
            <CardPreview
              {fields}
              audio={review.entry !== undefined &&
                playableAudio(review.entry, review.current.server) !== undefined}
              {dark}
            />
          </div>
        </section>
        <section class="flex flex-col gap-4 max-xl:hidden">
          <CardPreview
            {fields}
            audio={review.entry !== undefined &&
              playableAudio(review.entry, review.current.server) !== undefined}
            {dark}
          />
          <KeyLegend bind:this={legend} />
        </section>
      </div>
    {/if}
  </main>
</div>
