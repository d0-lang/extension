<script lang="ts">
  import type { Snippet } from "svelte"

  /** A section's name on top of it. `children` sits at the other end, like an Add button. */
  let { title, children }: { title: string; children?: Snippet } = $props()
</script>

<!-- Closer to what is under it than the section's parts are to each other. -->
<div class="-mb-2 flex min-h-8 items-center justify-between gap-4">
  <h1 class="text-2xl font-semibold tracking-tight">{title}</h1>
  {@render children?.()}
</div>
