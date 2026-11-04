<script lang="ts">
  import Logo from "$lib/components/Logo.svelte";
  import Appearance from "./Appearance.svelte";
  import Hotkeys from "./Hotkeys.svelte";
  import Lookup from "./Lookup.svelte";
  import Servers from "./servers";
</script>

<div class="bg-background min-h-svh">
  <header class="border-b">
    <div class="mx-auto flex h-14 max-w-3xl items-center gap-2 px-6">
      <Logo class="text-foreground h-6" />
      <p class="text-lg tracking-tight">
        <span class="font-normal">Da</span><span class="font-bold">Dict</span>
      </p>
    </div>
  </header>

  <main class="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-8">
    <Servers />
    <Lookup />
    <Appearance />
    <Hotkeys />
  </main>
</div>
