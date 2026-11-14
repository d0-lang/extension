<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right"

  let { open }: { open: () => void } = $props()
</script>

<!-- In the space the last sense keeps free, level with the bottom of its last line. -->
<button
  type="button"
  class="text-muted-foreground/70 hover:text-foreground focus-visible:text-foreground absolute right-0 bottom-0 inline-flex cursor-pointer items-center gap-0.5 rounded-sm text-xs"
  onclick={open}
>
  Sources
  <ChevronRight class="size-3" aria-hidden="true" />
</button>
