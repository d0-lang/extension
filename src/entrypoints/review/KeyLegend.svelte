<script lang="ts">
  import Keycap from "$lib/components/Keycap.svelte"
  import { LEGEND, litKeys } from "./legend"

  /** The row a key just did something for, and the keys pressed for it. */
  let lit = $state.raw<{ row: number; keys: Array<string> }>()
  let timer: ReturnType<typeof setTimeout> | undefined

  /** Lights `row` and its keys among `keys` for a moment, to show which line the press did. */
  export const flash = (row: number, keys: Array<string>) => {
    clearTimeout(timer)
    lit = { row, keys }
    timer = setTimeout(() => (lit = undefined), 350)
  }
</script>

<!-- Colour only, no movement, and it lights up at once but fades slowly, so quick presses read as a trail. -->
<dl class="text-muted-foreground grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
  {#each LEGEND as row, index (row.action)}
    {@const on = lit?.row === index}
    <dt class="relative flex flex-wrap items-center gap-1 pl-2.5">
      <span
        class={[
          "bg-link absolute inset-y-1 left-0 w-0.5 rounded-full transition-opacity",
          on ? "opacity-70 duration-50" : "opacity-0 duration-600",
        ]}
        aria-hidden="true"
      ></span>
      {#each row.groups as keys, group (group)}
        {@const pressed = on ? litKeys(keys, lit?.keys ?? []) : []}
        {#if group > 0}<span class="px-0.5">or</span>{/if}
        {#each keys as key, keyIndex (keyIndex)}<Keycap
            class={[
              "transition-colors",
              pressed[keyIndex] === true ? "border-link/45 bg-link/15 duration-50" : "duration-600",
            ]}>{key}</Keycap
          >{/each}
      {/each}
    </dt>
    <dd class={["transition-colors", on ? "text-foreground duration-50" : "duration-600"]}>{row.action}</dd>
  {/each}
</dl>
