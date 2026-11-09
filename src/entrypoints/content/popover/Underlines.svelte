<script lang="ts">
  import type { AnchorRect } from "../page/pick"

  /** `dark` is the page behind the words, which picks the accent that shows up there. */
  let { rects, dark }: { rects: Array<AnchorRect>; dark: boolean } = $props()
</script>

{#each rects as rect, rectIndex (rectIndex)}
  <div
    class={["dict-underline bg-link fixed", dark && "dark"]}
    style:top="{rect.bottom - 2}px"
    style:left="{rect.left}px"
    style:width="{rect.right - rect.left}px"
    aria-hidden="true"
  ></div>
{/each}
