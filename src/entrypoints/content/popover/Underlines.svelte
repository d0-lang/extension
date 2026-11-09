<script lang="ts">
  import type { AnchorRect } from "../page/pick"
  import { trackUnderlines } from "./underline"

  /** `dark` is the page behind the words, which picks the accent that shows up there. */
  let { ranges, dark }: { ranges: Array<Range>; dark: boolean } = $props()

  let lines = $state.raw<Array<AnchorRect>>([])

  $effect(() =>
    trackUnderlines(ranges, (next) => {
      lines = next
    }),
  )
</script>

{#each lines as line, lineIndex (lineIndex)}
  <div
    class={["dict-underline bg-link fixed", dark && "dark"]}
    style:top="{line.bottom - 2}px"
    style:left="{line.left}px"
    style:width="{line.right - line.left}px"
    aria-hidden="true"
  ></div>
{/each}
