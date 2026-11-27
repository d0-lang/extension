<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down"
  import { onMount } from "svelte"
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert"
  import { Button } from "$lib/components/ui/button"
  import { Checkbox } from "$lib/components/ui/checkbox"
  import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "$lib/components/ui/dialog"
  import { Input } from "$lib/components/ui/input"
  import { Label } from "$lib/components/ui/label"
  import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group"
  import { creditSources, type LegalDocument } from "$lib/dict"
  import { pairName } from "$lib/languages"
  import { groupByTarget, pairMatches, sourceName } from "../languages"
  import { hasMouse } from "../pointer"
  import SignedSeal from "./SignedSeal.svelte"
  import type { ContextSending } from "$lib/storage"
  import { ServerSetup } from "../ServerSetup.svelte"
  import SourceCredits from "./SourceCredits.svelte"

  /** Past this many languages, ticking them one by one gets tedious. */
  const SELECT_ALL_FROM = 6
  /** From this many languages, the list gets a filter and its own scroll. */
  const FILTER_FROM = 8

  let { setup }: { setup: ServerSetup } = $props()

  /** Typing a language first suits a mouse and keyboard. */
  const typesFirst = hasMouse()
  let title = $state<HTMLElement | null>(null)

  // Elsewhere the dialog would hand the focus Connect had to its first field, the filter, and bring up the keyboard.
  onMount(() => {
    if (typesFirst) {
      return
    }
    const frame = requestAnimationFrame(() => title?.focus())
    return () => cancelAnimationFrame(frame)
  })

  const draft = $derived(setup.draft)
  const languages = $derived(draft?.meta.languages ?? [])
  /**
   * A long list scrolls on its own beside a mouse. On a phone it is part of the dialog's scroll instead: swiping through
   * a list of its own stops at its end, and nothing says to swipe outside it to reach the rest.
   */
  const scrollsOnItsOwn = $derived(languages.length >= FILTER_FROM && typesFirst)
  const legal = $derived(draft?.meta.legal)
  const takesContext = $derived(draft?.meta.features.includes("context") === true)
  const sources = $derived(creditSources(draft?.meta.sources))

  let body = $state<HTMLElement>()
  /** Whether the dialog's body has more under what shows, like Privacy under a long list of languages. */
  let below = $state(false)
  const checkBelow = () => {
    below = body !== undefined && body.scrollHeight - body.scrollTop - body.clientHeight > 8
  }

  // As the window, or what the body holds, changes size.
  $effect(() => {
    const scroller = body
    if (scroller === undefined) {
      return
    }
    const sizes = new ResizeObserver(checkBelow)
    const watch = () => {
      sizes.disconnect()
      sizes.observe(scroller)
      for (const child of scroller.children) {
        sizes.observe(child)
      }
    }
    // Parts come and go, like an alert or the filter's "No languages match".
    const parts = new MutationObserver(watch)
    parts.observe(scroller, { childList: true })
    watch()
    return () => {
      sizes.disconnect()
      parts.disconnect()
    }
  })

  const documentName: Record<LegalDocument, string> = {
    privacy: "privacy policy",
    tos: "terms of service",
  }
  let filter = $state("")
  const groups = $derived(groupByTarget(languages.filter((lang) => pairMatches(lang, filter))))

  const pickContext = (value: string) => {
    setup.context = contextOptions.find((option) => option.value === value)?.value ?? setup.context
  }

  const contextOptions = [
    { value: "all", label: "From all sites" },
    {
      value: "unblocked",
      label: "From all sites except blocked ones",
      hint: "Blocked sites have their own section in settings.",
    },
    { value: "none", label: "Never" },
  ] satisfies Array<{ value: ContextSending; label: string; hint?: string }>

  /** The language the list's one Tab stop is on. The arrows move it, as they do in the Sentences choice. */
  let current = $state<string>()
  const shownPairs = $derived(groups.flatMap((group) => group.pairs))
  const tabStop = $derived(current !== undefined && shownPairs.includes(current) ? current : shownPairs[0])

  const arrowSteps: Record<string, 1 | -1> = { ArrowDown: 1, ArrowUp: -1 }

  /** Arrow keys move focus between the checkboxes, wrapping at either end. */
  const cycleFocus = (event: KeyboardEvent) => {
    const step = arrowSteps[event.key]
    if (step === undefined || !(event.currentTarget instanceof HTMLElement)) {
      return
    }
    const boxes = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-slot="checkbox"]')]
    const index = boxes.findIndex((box) => box === document.activeElement)
    if (index === -1) {
      return
    }
    event.preventDefault()
    boxes[(index + step + boxes.length) % boxes.length]?.focus()
  }
</script>

{#if draft}
  <DialogHeader>
    <DialogTitle bind:ref={title} tabindex={-1} class="pr-6 wrap-anywhere outline-none"
      >{draft.meta.name}</DialogTitle
    >
    <DialogDescription class="font-mono text-xs wrap-anywhere">
      {draft.url}
    </DialogDescription>
  </DialogHeader>

  <div class="relative -mx-4 -mt-1 flex min-h-0 flex-col">
    <!-- Room around the edges for focus rings, which the scroll would cut. A scrollbar takes part of the side's. -->
    <div bind:this={body} class="flex min-h-0 flex-col gap-3 overflow-y-auto px-4 pt-1" onscroll={checkBelow}>
      {#if setup.isNew}
        <SignedSeal />
      {/if}
      {#if draft.movedFrom !== undefined}
        <Alert>
          <AlertTitle>This server has moved</AlertTitle>
          <AlertDescription>
            From {draft.movedFrom}. Saving updates its address.
          </AlertDescription>
        </Alert>
      {/if}
      {#if setup.testingOnly}
        <Alert variant="destructive">
          <AlertTitle>No privacy policy or terms</AlertTitle>
          <AlertDescription>
            Use this server only for testing, and only if you develop or run it. Saving accepts that it gets
            the words you look up{takesContext
              ? ", and the sentences around them if you allow it below"
              : ""}.
          </AlertDescription>
        </Alert>
      {:else if legal !== undefined && setup.changedDocuments.length > 0}
        <Alert>
          <AlertTitle>
            Updated {setup.changedDocuments.map((document) => documentName[document]).join(" and ")}
          </AlertTitle>
          <AlertDescription class="flex flex-col gap-1">
            <ul class="list-disc pl-5">
              {#each setup.changedDocuments as document (document)}
                {@const change = document === "privacy" ? legal.privacy_change : legal.tos_change}
                {@const href = document === "privacy" ? legal.privacy_link : legal.tos_link}
                <li class="py-0.5 wrap-anywhere">
                  {#if change !== undefined}
                    <span class="font-medium">The server says:</span> {change}
                  {/if}
                  <a class="underline" {href} target="_blank" rel="noreferrer"
                    >Read the {documentName[document]}</a
                  >
                </li>
              {/each}
            </ul>
            <p>Lookups to this server wait until you save.</p>
          </AlertDescription>
        </Alert>
      {/if}
      {#if setup.droppedLanguages.length > 0}
        <Alert>
          <AlertTitle>Languages no longer offered</AlertTitle>
          <AlertDescription>
            Saving removes {setup.droppedLanguages.map(pairName).join(", ")}.
          </AlertDescription>
        </Alert>
      {/if}

      {#if languages.length === 0}
        <p class="text-muted-foreground">This server doesn't offer any languages yet.</p>
      {:else}
        {#snippet selectAll(className: string)}
          <Button
            variant="link"
            size="xs"
            class={className}
            onclick={() => setup.selectAll(!setup.allSelected)}
          >
            {setup.allSelected ? "Clear all" : "Select all"}
          </Button>
        {/snippet}
        <!-- The dialog scrolls, so the list keeps its height when the dialog is short. -->
        <div class="flex shrink-0 flex-col gap-2">
          <div class="flex items-center justify-between gap-2">
            <p class="font-medium">Languages</p>
            {#if languages.length >= SELECT_ALL_FROM && languages.length < FILTER_FROM}
              {@render selectAll("-mr-1 px-1")}
            {/if}
          </div>
          {#if languages.length >= FILTER_FROM}
            <!-- Most people want a few languages, so typing one comes first and Select all after it. -->
            <div class="flex items-center gap-2">
              <!-- svelte-ignore a11y_autofocus -->
              <Input
                bind:value={filter}
                placeholder="Filter languages"
                aria-label="Filter languages"
                autofocus={typesFirst}
                class="flex-1"
              />
              {@render selectAll("-mr-1 shrink-0 px-1")}
            </div>
          {/if}
          <!-- A fixed height beside a mouse, so filtering does not resize the dialog. It ends partway through a row, so
             the cut row shows there is more to scroll to. No top padding, since rows would show above the sticky
             heading. -->
          <!-- Only delegates arrow keys between the checkboxes inside. -->
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <div
            class={[
              "flex flex-col",
              scrollsOnItsOwn
                ? "h-58 overflow-y-auto overscroll-contain rounded-md border px-1 pb-1"
                : languages.length >= FILTER_FROM
                  ? "rounded-md border px-1 pb-1"
                  : "-mx-2",
            ]}
            role="group"
            aria-label="Languages"
            onkeydown={cycleFocus}
          >
            {#each groups as group (group.into)}
              <!-- Its own box, so the heading stops sticking where the group ends. -->
              <div>
                <!-- Chrome sticks it below the scroller's top padding. A short list scrolls with the dialog, whose
                   padding keeps room for focus rings, so it sticks that much higher to leave no gap above it. -->
                <p
                  class={[
                    "bg-popover text-muted-foreground sticky z-10 px-2 py-1 text-xs font-medium",
                    scrollsOnItsOwn ? "top-0" : "-top-1",
                  ]}
                >
                  Into {group.into}
                </p>
                <ul class="flex flex-col">
                  {#each group.pairs as lang (lang)}
                    {@const owner = setup.ownerElsewhere(lang)}
                    <li>
                      <Label
                        for={`lang-${lang}`}
                        class="hover:bg-muted/50 has-focus-visible:bg-muted/50 cursor-pointer gap-3 rounded-md px-2 py-2 font-normal"
                      >
                        <Checkbox
                          id={`lang-${lang}`}
                          bind:checked={setup.selected[lang]}
                          tabindex={lang === tabStop ? 0 : -1}
                          onfocus={() => (current = lang)}
                        />
                        <span class="flex min-w-0 flex-1 flex-col gap-1">
                          <span title={pairName(lang)}>{sourceName(lang)}</span>
                          {#if owner !== undefined}
                            <span
                              class={[
                                "text-xs wrap-anywhere",
                                setup.selected[lang]
                                  ? "text-foreground font-medium"
                                  : "text-muted-foreground",
                              ]}
                            >
                              {setup.selected[lang] ? `Moves from ${owner}` : `Used by ${owner}`}
                            </span>
                          {/if}
                        </span>
                      </Label>
                    </li>
                  {/each}
                </ul>
              </div>
            {:else}
              <p class="text-muted-foreground px-2 py-2">No languages match.</p>
            {/each}
          </div>
        </div>
      {/if}

      {#if takesContext}
        <div class="flex flex-col gap-2">
          <div class="flex flex-col gap-1">
            <p class="font-medium" id="context-label">Sentences</p>
            <p class="text-muted-foreground">
              Send this server the whole sentence, not just the word, for more accurate results.
            </p>
          </div>
          <RadioGroup
            class="-mx-2 gap-0"
            value={setup.context}
            onValueChange={pickContext}
            aria-labelledby="context-label"
          >
            {#each contextOptions as option (option.value)}
              <Label
                for={`context-${option.value}`}
                class="hover:bg-muted/50 has-focus-visible:bg-muted/50 cursor-pointer items-start gap-3 rounded-md px-2 py-2 font-normal"
              >
                <RadioGroupItem id={`context-${option.value}`} value={option.value} class="mt-0.5" />
                <span class="flex min-w-0 flex-col gap-1">
                  <span>{option.label}</span>
                  {#if "hint" in option}
                    <span class="text-muted-foreground text-xs">{option.hint}</span>
                  {/if}
                </span>
              </Label>
            {/each}
          </RadioGroup>
        </div>
      {/if}

      <div class="flex flex-col gap-1">
        <p class="font-medium">Privacy</p>
        <p class="text-muted-foreground">
          This server sees every word you look up, and your IP address.{takesContext
            ? " If you let it, it also gets the sentence around each word."
            : ""}
        </p>
        {#if legal !== undefined}
          <p class="text-muted-foreground">
            Learn more in its
            <a class="text-foreground underline" href={legal.privacy_link} target="_blank" rel="noreferrer"
              >privacy policy</a
            >
            and
            <a class="text-foreground underline" href={legal.tos_link} target="_blank" rel="noreferrer"
              >terms of service</a
            >.
          </p>
        {/if}
        {#if setup.needsPrivacyTick}
          <Label
            for="privacy-understood"
            class="hover:bg-muted/50 has-focus-visible:bg-muted/50 -mx-2 mt-1 cursor-pointer gap-3 rounded-md px-2 py-2 font-normal"
          >
            <Checkbox id="privacy-understood" bind:checked={setup.privacyUnderstood} />
            <span>I understand what this server gets</span>
          </Label>
        {/if}
      </div>

      {#if sources.length > 0}
        <div class="flex flex-col gap-1">
          <p class="font-medium">Sources</p>
          <SourceCredits {sources} />
        </div>
      {/if}

      {#if setup.genericError}
        <Alert variant="destructive">
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{setup.genericError}</AlertDescription>
        </Alert>
      {/if}
    </div>
    {#if below}
      <!-- The buttons stay put under the scroll, so a short window would look like it ends after the languages. -->
      <div
        class="from-popover pointer-events-none absolute inset-x-0 bottom-0 flex h-14 items-end justify-center bg-linear-to-t to-transparent pb-2"
      >
        <button
          type="button"
          class="bg-popover text-muted-foreground hover:text-foreground pointer-events-auto flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs shadow-sm"
          onclick={() => body?.scrollBy({ top: body.clientHeight * 0.8, behavior: "smooth" })}
        >
          More below <ChevronDownIcon class="size-3.5" />
        </button>
      </div>
    {/if}
  </div>

  <DialogFooter class="py-2 sm:items-center">
    <!-- Add comes before Back in the tab order, since Esc already leaves. `order` keeps Back on its left. -->
    {#if !setup.canSave && languages.length > 0}
      <p class="text-muted-foreground order-1 text-center sm:mr-auto sm:text-left">
        Pick at least one language.
      </p>
    {:else if !setup.privacyReady}
      <p class="text-muted-foreground order-1 text-center sm:mr-auto sm:text-left">
        Read Privacy, then tick the box.
      </p>
    {/if}
    <Button
      class="order-3"
      onclick={() => void setup.save()}
      disabled={setup.saving || !setup.canSave || !setup.privacyReady || setup.legalLock.locked}
    >
      {#if setup.saving}
        Saving…
      {:else}
        {setup.isNew ? "Add server" : "Save"}{setup.legalLock.locked ? ` (${setup.legalLock.seconds})` : ""}
      {/if}
    </Button>
    {#if !setup.isEditing}
      <Button variant="outline" class="order-2" disabled={setup.saving} onclick={setup.backToConnect}
        >Back</Button
      >
    {/if}
  </DialogFooter>
{/if}
