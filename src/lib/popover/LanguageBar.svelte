<script lang="ts">
  import { pairName, shortNames } from "$lib/languages"

  let {
    languages,
    shown,
    pick,
  }: {
    languages: Array<string>
    shown: string | undefined
    pick: (code: string) => void
  } = $props()

  const names = $derived(shortNames(languages))

  /** Faded at an end with more languages past it, wide enough that a language there shows it is cut off. */
  const FADE_PX = 32

  let strip = $state<HTMLElement>()
  /** Whether there are more languages to scroll to on each side. */
  let more = $state({ start: false, end: false })

  const measure = () => {
    if (strip !== undefined) {
      more = {
        start: strip.scrollLeft > 0,
        end: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1,
      }
    }
  }

  $effect(() => {
    if (strip === undefined) {
      return
    }
    const observer = new ResizeObserver(measure)
    observer.observe(strip)
    return () => observer.disconnect()
  })

  /** Scrolls as little as it can to bring `button` clear of the faded ends. */
  const scrollToShow = (bar: HTMLElement, button: HTMLElement, behavior: ScrollBehavior) => {
    const { left, right } = bar.getBoundingClientRect()
    const item = button.getBoundingClientRect()
    const by =
      item.left < left + FADE_PX
        ? item.left - (left + FADE_PX)
        : item.right > right - FADE_PX
          ? item.right - (right - FADE_PX)
          : 0
    if (by !== 0) {
      bar.scrollBy({ left: by, behavior })
    }
  }

  /** Set once the bar has scrolled to the language it opened on. */
  let placed = false

  // On open, the language in use can be scrolled out of view. A pick under a faded end slides clear of it.
  $effect(() => {
    const button = shown === undefined ? null : strip?.querySelector(`[data-code="${CSS.escape(shown)}"]`)
    if (strip !== undefined && button instanceof HTMLElement) {
      const still = !placed || matchMedia("(prefers-reduced-motion: reduce)").matches
      scrollToShow(strip, button, still ? "instant" : "smooth")
      placed = true
    }
  })

  /** Lets a mouse wheel scroll the bar sideways. Svelte's `onwheel` is passive, so it could not keep the page still. */
  const wheelScrolls = (target: HTMLElement) => {
    const onWheel = (event: WheelEvent) => {
      if (target.scrollWidth > target.clientWidth && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        event.preventDefault()
        target.scrollLeft += event.deltaY
      }
    }
    target.addEventListener("wheel", onWheel, { passive: false })
    return () => target.removeEventListener("wheel", onWheel)
  }
</script>

<div class="mt-auto flex shrink-0 items-center gap-2 border-t p-2">
  <div
    bind:this={strip}
    {@attach wheelScrolls}
    class={[
      "flex min-w-0 flex-1 justify-center-safe gap-1 overflow-x-auto [scrollbar-width:none]",
      more.start && more.end
        ? "mask-x-from-[calc(100%-2rem)] mask-x-to-100%"
        : more.start
          ? "mask-l-from-[calc(100%-2rem)] mask-l-to-100%"
          : more.end && "mask-r-from-[calc(100%-2rem)] mask-r-to-100%",
    ]}
    role="group"
    aria-label="Languages"
    onscroll={measure}
  >
    {#each languages as code (code)}
      {@const active = shown === code}
      <button
        type="button"
        data-code={code}
        class={[
          "h-6 min-w-8 shrink-0 cursor-pointer rounded-md border px-2 text-xs font-medium",
          active
            ? "bg-muted text-foreground border-foreground/25"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        ]}
        aria-pressed={active}
        title="Use {pairName(code)} on this page. Change the order under Appearance in settings."
        onclick={() => pick(code)}
      >
        {names.get(code) ?? code}
      </button>
    {/each}
  </div>
</div>
