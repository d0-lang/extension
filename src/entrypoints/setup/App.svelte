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
  import Subtitles from "./sections/subtitles/Subtitles.svelte"

  const route = new Route()
  onMount(route.watch)

  /** From `md` up a section is always open beside the sidebar. */
  const open = $derived(route.section ?? FIRST_SECTION)
</script>

<!-- From `xl` up, with room to spare, the whole page is one card in the middle of the window. -->
<!-- The sidebar and the section each scroll inside it. Below that the page fills the window and scrolls. -->
<div class="bg-background xl:bg-backdrop min-h-svh xl:flex xl:h-svh xl:p-8">
  <div
    class="xl:bg-background xl:mx-auto xl:flex xl:w-full xl:max-w-[72rem] xl:flex-col xl:overflow-hidden xl:rounded-xl xl:border xl:shadow-sm"
  >
    <Header inSection={route.section !== undefined} back={route.toList} />

    <div
      class="md:grid md:grid-cols-[14rem_minmax(0,1fr)] lg:grid-cols-[15.5rem_minmax(0,1fr)] xl:min-h-0 xl:flex-1"
    >
      <Sidebar
        active={open}
        class="min-h-[calc(100svh-3.5rem)] md:sticky md:top-14 md:h-[calc(100svh-3.5rem)] md:min-h-0 md:overflow-y-auto xl:static xl:h-auto {route.section ===
        undefined
          ? ''
          : 'max-md:hidden'}"
      />

      <main
        class={[
          "min-w-0 px-4 pt-5 pb-10 md:px-8 md:pt-8 xl:min-h-0 xl:overflow-y-auto xl:px-6",
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
          {:else if open === "subtitles"}
            <Subtitles />
          {:else}
            <Hotkeys />
          {/if}
        </div>
      </main>
    </div>
  </div>
</div>
