<script lang="ts">
  import { onMount } from "svelte"
  import Header from "./layout/Header.svelte"
  import { Route } from "./layout/route.svelte"
  import { FIRST_SECTION } from "./layout/sections"
  import Sidebar from "./layout/Sidebar.svelte"
  import Appearance from "./sections/appearance/Appearance.svelte"
  import Hotkeys from "./sections/Hotkeys.svelte"
  import Integrations from "./sections/integrations/Integrations.svelte"
  import Servers from "./sections/servers"
  import BlockedSites from "./sections/sites/BlockedSites.svelte"

  const route = new Route()
  onMount(route.watch)

  /** From `md` up a section is always open beside the sidebar. */
  const open = $derived(route.section ?? FIRST_SECTION)
</script>

<div class="bg-background min-h-svh">
  <Header inSection={route.section !== undefined} />

  <div class="md:grid md:grid-cols-[15rem_minmax(0,1fr)] lg:grid-cols-[17.5rem_minmax(0,1fr)]">
    <Sidebar
      active={open}
      class="min-h-[calc(100svh-3.5rem)] md:sticky md:top-14 md:h-[calc(100svh-3.5rem)] md:min-h-0 md:overflow-y-auto {route.section ===
      undefined
        ? ''
        : 'max-md:hidden'}"
    />

    <main class={["min-w-0 px-4 pt-5 pb-10 md:px-8 md:pt-8", route.section === undefined && "max-md:hidden"]}>
      {#if open === "servers"}
        <Servers />
      {:else if open === "integrations"}
        <Integrations />
      {:else if open === "sites"}
        <BlockedSites />
      {:else if open === "appearance"}
        <Appearance />
      {:else}
        <Hotkeys />
      {/if}
    </main>
  </div>
</div>
