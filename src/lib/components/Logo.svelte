<script lang="ts">
  import type { SVGAttributes } from "svelte/elements"

  /** The DaDict mark. It fills with `currentColor`, so set its colour with a text class. */
  let { class: className, ...rest }: SVGAttributes<SVGSVGElement> = $props()
</script>

<svg viewBox="12 8 42 48" fill="currentColor" aria-hidden="true" class={className} {...rest}>
  <path
    fill-rule="evenodd"
    d="M14 8H36C36.34 8 36.673 8.001 37 8.004L37 28L42 23L47 28L47 9.108C52.731 10.942 54 15.509 54 26V38C54 53.3 51.3 56 36 56H14A2 2 0 0 1 12 54V10A2 2 0 0 1 14 8ZM33.5 14.25H18.25V49.75H36C45.988 49.75 47.75 47.988 47.75 38V33.7L44.25 30.2V38C44.25 45.013 43.013 46.25 36 46.25H21.75V17.75H33.5Z"
  />
</svg>
