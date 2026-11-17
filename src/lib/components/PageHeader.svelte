<script lang="ts">
  import { cn } from "$lib/utils"
  import Brand from "./Brand.svelte"

  /** The DaDict bar on top of an extension page. `class` sets the inner width, to line up with the page. */
  let { class: className }: { class?: string } = $props()
</script>

<header class="border-b">
  <div class={cn("mx-auto flex h-14 items-center px-6", className)}>
    <Brand />
  </div>
</header>
