<script lang="ts">
  import { cn } from "$lib/utils"
  import Logo from "./Logo.svelte"

  /** The DaDict bar on top of an extension page. `class` sets the inner width, to line up with the page. */
  let { class: className }: { class?: string } = $props()
</script>

<header class="border-b">
  <div class={cn("mx-auto flex h-14 items-center gap-2 px-6", className)}>
    <Logo class="text-foreground h-6" />
    <p class="text-lg tracking-tight">
      <span class="font-normal">Da</span><span class="font-bold">Dict</span>
    </p>
  </div>
</header>
