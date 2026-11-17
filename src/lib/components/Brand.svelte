<script lang="ts">
  import { cn } from "$lib/utils"
  import Logo from "./Logo.svelte"

  /** The DaDict logo and name. */
  let { class: className }: { class?: string } = $props()
</script>

<div class={cn("flex items-center gap-2", className)}>
  <Logo class="text-foreground h-6" />
  <p class="text-lg tracking-tight">
    <span class="font-normal">Da</span><span class="font-bold">Dict</span>
  </p>
</div>
