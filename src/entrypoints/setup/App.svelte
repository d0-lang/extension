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

<!-- From `md` up, the whole page is one card in the middle of the window. The sidebar and the section each scroll inside it. -->
<div class="bg-background md:bg-backdrop min-h-svh md:flex md:h-svh md:p-6 lg:p-8">
  <div
    class="md:bg-background md:mx-auto md:flex md:w-full md:max-w-[68rem] md:flex-col md:overflow-hidden md:rounded-xl md:border md:shadow-sm"
  >
    <Header inSection={route.section !== undefined} back={route.toList} />

    <div
      class="md:grid md:min-h-0 md:flex-1 md:grid-cols-[14rem_minmax(0,1fr)] lg:grid-cols-[15.5rem_minmax(0,1fr)]"
    >
      <Sidebar
        active={open}
        class="min-h-[calc(100svh-3.5rem)] md:min-h-0 md:overflow-y-auto {route.section === undefined
          ? ''
          : 'max-md:hidden'}"
      />

      <main
        class={[
          "min-w-0 px-4 pt-5 pb-10 md:min-h-0 md:overflow-y-auto md:px-8 md:pt-8",
          route.section === undefined && "max-md:hidden",
        ]}
      >
        <!-- One column for every section, so the title stays put when the section changes. Sections size to it. -->
        <div class="@container mx-auto w-full max-w-5xl">
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
        </div>
      </main>
    </div>
  </div>
</div>
