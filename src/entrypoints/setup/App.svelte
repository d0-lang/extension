<script lang="ts">
  import PageHeader from "$lib/components/PageHeader.svelte"
  import Appearance from "./sections/Appearance.svelte"
  import Hotkeys from "./sections/Hotkeys.svelte"
  import Lookup from "./sections/Lookup.svelte"
  import Servers from "./sections/servers"
</script>

<div class="bg-background min-h-svh">
  <PageHeader class="max-w-3xl" />

  <main class="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-8">
    <Servers />
    <Lookup />
    <Appearance />
    <Hotkeys />
  </main>
</div>
