<script lang="ts">
  import type { Snippet } from "svelte"

  /** A section's name on top of it. `children` sits at the other end, like an Add button. */
  let { title, children }: { title: string; children?: Snippet } = $props()
</script>

<div class="flex min-h-9 items-center justify-between gap-4">
  <h1 class="text-2xl font-semibold tracking-tight">{title}</h1>
  {@render children?.()}
</div>
