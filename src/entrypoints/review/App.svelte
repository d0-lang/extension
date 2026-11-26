<script lang="ts">
  import { onMount } from "svelte"
  import Keycap from "$lib/components/Keycap.svelte"
  import PageHeader from "$lib/components/PageHeader.svelte"
  import { playableAudio } from "$lib/dict/entries"
  import { getShowIpa } from "$lib/storage"
  import CardPreview from "./CardPreview.svelte"
  import Editor from "./Editor.svelte"
  import { noteFields } from "./fields"
  import { reviewAction } from "./keys"
  import { Review } from "./review.svelte"
  import WordList from "./WordList.svelte"

  const review = new Review()
  /** Whether cards get IPA, as the popover shows it. */
  let ipa = $state(true)
  let dark = $state(false)

  const fields = $derived.by(() => {
    const { current, draft } = review
    if (current === undefined || draft === undefined) {
      return undefined
    }
    return noteFields(current, draft, ipa)
  })

  /** Each row's key groups do the same, so they are joined with "or". */
  const legend = [
    {
      groups: [
        ["W", "S"],
        ["K", "J"],
      ],
      action: "Move up and down",
    },
    {
      groups: [
        ["Shift", "W", "S"],
        ["Shift", "K", "J"],
      ],
      action: "Previous or next word",
    },
    {
      groups: [
        ["A", "D"],
        ["H", "L"],
      ],
      action: "Another entry of the word",
    },
    { groups: [["Space"], ["Enter"], ["1–9"]], action: "Pick a meaning" },
    { groups: [["E"], ["I"]], action: "Edit" },
    { groups: [["Ctrl", "Enter"]], action: "Send to Anki" },
    { groups: [["X"]], action: "Drop the word" },
  ]

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
      <div class="mx-auto flex max-w-md flex-col gap-2 py-16 text-center">
        <h1 class="text-xl font-semibold">No kept words</h1>
        <p class="text-muted-foreground text-sm">
          Press <Keycap>Q</Keycap> in the popover, or its bookmark button, to keep a word with its sentence. It
          waits here until you pick its meanings and send it to Anki.
        </p>
      </div>
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
          <Editor {review} seed={review.current} draft={review.draft} sentence={fields.Sentence} />
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
          <dl class="text-muted-foreground grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
            {#each legend as row (row.action)}
              <dt class="flex flex-wrap items-center gap-1">
                {#each row.groups as keys, group (group)}
                  {#if group > 0}<span class="px-0.5">or</span>{/if}
                  {#each keys as key, index (index)}<Keycap>{key}</Keycap>{/each}
                {/each}
              </dt>
              <dd>{row.action}</dd>
            {/each}
          </dl>
        </section>
      </div>
    {/if}
  </main>
</div>
