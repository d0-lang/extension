<script lang="ts">
  import { onMount, tick } from "svelte"
  import { flip } from "svelte/animate"
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical"
  import { pairName, shortNames } from "$lib/languages"
  import { setLanguageOrder } from "$lib/storage"
  import { LANGUAGE_KEYS, orderedLanguages } from "./languages"
  import { dropIndex, moved } from "./reorder"

  /** `onload` runs once the languages are first read, so the settings around the list can show with it. */
  let { onload }: { onload?: () => void } = $props()

  const FLIP_MS = 150

  /** Bound languages in the order the popover shows them, with the paused ones in their place too. */
  let order = $state.raw<Array<string>>([])
  let paused = $state.raw<Array<string>>([])
  let list = $state<HTMLElement>()
  /** As the popover's footer names them. */
  const names = $derived(shortNames(order))
  /** `grab` is where the item was pressed, from its top. `lift` moves it from its place to under the pointer. */
  let drag = $state<{ code: string; pointer: number; grab: number; lift: number }>()

  const load = async () => {
    const next = await orderedLanguages()
    order = next.order
    paused = next.paused
    onload?.()
  }

  onMount(() => {
    void load()
    // Adding a server or a language changes the list, from this tab or another.
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area === "local" && drag === undefined && LANGUAGE_KEYS.some((key) => key in changes)) {
        void load()
      }
    }
    browser.storage.onChanged.addListener(onChanged)
    return () => browser.storage.onChanged.removeListener(onChanged)
  })

  const save = (next: Array<string>) => {
    order = next
    void setLanguageOrder(next)
  }

  const handleOf = (code: string) => list?.querySelector<HTMLElement>(`[data-handle="${CSS.escape(code)}"]`)
  const itemOf = (code: string) =>
    list?.querySelector<HTMLElement>(`li[data-code="${CSS.escape(code)}"]`) ?? undefined

  /** The pointer's height in the list. */
  const pointerY = (event: PointerEvent, target: HTMLElement) =>
    event.clientY - target.getBoundingClientRect().top

  const onPointerDown = (event: PointerEvent, code: string) => {
    const item = itemOf(code)
    if (list === undefined || item === undefined || (event.pointerType === "mouse" && event.button !== 0)) {
      return
    }
    event.preventDefault()
    drag = { code, pointer: event.pointerId, grab: pointerY(event, list) - item.offsetTop, lift: 0 }
    // On the list, since moving the item moves its handle, which would lose the capture.
    list.setPointerCapture(event.pointerId)
  }

  const onPointerMove = async (event: PointerEvent) => {
    const item = drag === undefined ? undefined : itemOf(drag.code)
    if (drag === undefined || list === undefined || item === undefined || event.pointerId !== drag.pointer) {
      return
    }
    const top = pointerY(event, list) - drag.grab
    // From the layout, which the slide animation's transforms leave alone, so the target does not flicker.
    const middles = [...list.children]
      .filter((other): other is HTMLElement => other instanceof HTMLElement && other !== item)
      .map((other) => other.offsetTop + other.offsetHeight / 2)
    const next = moved(order, drag.code, dropIndex(middles, top + item.offsetHeight / 2))
    if (next.join() !== order.join()) {
      order = next
      await tick()
    }
    if (drag !== undefined) {
      drag.lift = top - item.offsetTop
    }
  }

  const endDrag = (event: PointerEvent) => {
    if (drag !== undefined && event.pointerId === drag.pointer) {
      drag = undefined
      save(order)
    }
  }

  const onKeyDown = async (event: KeyboardEvent, code: string) => {
    const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0
    const index = order.indexOf(code) + step
    if (step === 0 || index < 0 || index >= order.length) {
      return
    }
    event.preventDefault()
    save(moved(order, code, index))
    // Moving the item takes the focus off its handle.
    await tick()
    handleOf(code)?.focus()
  }
</script>

{#if order.length > 1}
  <div class="flex flex-col gap-3 p-4">
    <div class="flex flex-col gap-0.5">
      <p class="text-sm font-medium">Language order</p>
      <p class="text-muted-foreground text-sm">The order of the languages at the bottom of the popover.</p>
    </div>
    <ol
      bind:this={list}
      class="relative flex flex-col gap-1"
      aria-label="Language order"
      onpointermove={onPointerMove}
      onpointerup={endDrag}
      onpointercancel={endDrag}
    >
      {#each order as code (code)}
        {@const dragged = drag?.code === code}
        <li
          data-code={code}
          animate:flip={{ duration: dragged ? 0 : FLIP_MS }}
          style:transform={dragged ? `translateY(${drag?.lift ?? 0}px)` : undefined}
          class={[
            "bg-background flex items-center gap-2 rounded-md border py-1 pr-3 pl-1 text-sm",
            dragged ? "border-ring relative z-10 shadow-md" : "transition-transform",
          ]}
        >
          <button
            type="button"
            data-handle={code}
            class={[
              "text-muted-foreground hover:text-foreground focus-visible:ring-ring flex size-7 shrink-0 touch-none items-center justify-center rounded-sm outline-none focus-visible:ring-2",
              dragged ? "cursor-grabbing" : "cursor-grab",
            ]}
            aria-label="Move {pairName(code)}"
            title="Drag, or press ↑ and ↓, to move"
            onpointerdown={(event) => onPointerDown(event, code)}
            onkeydown={(event) => void onKeyDown(event, code)}
          >
            <GripVerticalIcon class="size-4" />
          </button>
          <span class="truncate">{pairName(code)}</span>
          <span class="text-muted-foreground shrink-0 text-xs">{names.get(code) ?? code}</span>
          {#if paused.includes(code)}
            <span class="text-muted-foreground ml-auto shrink-0 text-xs"
              >Paused until its server is fixed</span
            >
          {/if}
        </li>
      {/each}
    </ol>
  </div>
{/if}
