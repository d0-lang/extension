<script lang="ts">
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left"
  import Brand from "$lib/components/Brand.svelte"
  import LookupSwitch from "./LookupSwitch.svelte"

  /** The bar on top. On a phone, an open section shows the way back to the list instead of the name. */
  let { inSection, back }: { inSection: boolean; back: () => void } = $props()
</script>

<header class="bg-background sticky top-0 z-10 flex h-14 items-center gap-2 border-b px-4 md:px-5">
  {#if inSection}
    <button
      type="button"
      class="text-link -ml-1.5 inline-flex cursor-pointer items-center gap-0.5 rounded-md py-1 pr-2 pl-0.5 font-medium md:hidden"
      onclick={back}
    >
      <ChevronLeftIcon class="size-5" />
      Settings
    </button>
  {/if}
  <Brand class={inSection ? "hidden md:flex" : undefined} />
  <div class="ml-auto">
    <LookupSwitch />
  </div>
</header>
