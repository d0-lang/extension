<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left"

  /** The popover's top bar once a link has been followed, with the way back. */
  let { back }: { back: () => void } = $props()
</script>

<div class="flex border-b p-2">
  <button
    type="button"
    class="hover:bg-accent inline-flex h-6 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium"
    onclick={back}
  >
    <ArrowLeft class="size-3" />
    Back
  </button>
</div>
