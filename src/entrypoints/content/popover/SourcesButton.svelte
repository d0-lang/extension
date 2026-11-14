<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right"

  let { open }: { open: () => void } = $props()
</script>

<button
  type="button"
  class="text-muted-foreground/70 hover:text-foreground focus-visible:text-foreground inline-flex cursor-pointer items-center gap-0.5 self-end rounded-sm text-xs"
  onclick={open}
>
  Sources
  <ChevronRight class="size-3" aria-hidden="true" />
</button>
