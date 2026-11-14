<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right"

  let { open }: { open: () => void } = $props()
</script>

<div class="flex border-t pt-1.5">
  <button
    type="button"
    class="text-muted-foreground hover:bg-accent hover:text-foreground inline-flex h-6 cursor-pointer items-center gap-0.5 rounded-md px-1 text-xs font-medium"
    onclick={open}
  >
    Sources
    <ChevronRight class="size-3" aria-hidden="true" />
  </button>
</div>
