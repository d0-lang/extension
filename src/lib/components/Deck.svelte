<script lang="ts">
  import type { SVGAttributes } from "svelte/elements"

  /**
   * The Anki mark: two fanned cards, drawn in `currentColor`. `deck.ts` plays its motions. Set `--deck-fill` to the
   * colour behind it, so the cards cover each other.
   */
  let { class: className, ...rest }: SVGAttributes<SVGSVGElement> = $props()
</script>

<!-- Moved so the fan at rest sits in the middle: the upright card hugs the left, the tilted one reaches x 20. -->
<svg viewBox="-1.3 0.5 24 24" aria-hidden="true" class={["dict-deck", className]} {...rest}>
  <g class="dict-deck-pile">
    <rect class="dict-deck-under" x="1.5" y="4" width="9" height="14" rx="2" />
    <rect class="dict-deck-back" x="1.5" y="4" width="9" height="14" rx="2" />
    <rect class="dict-deck-front" x="1.5" y="4" width="9" height="14" rx="2" />
    <rect class="dict-deck-over" x="1.5" y="4" width="9" height="14" rx="2" />
  </g>
  <path class="dict-deck-plus" d="M18 0v6M15 3h6" />
</svg>
