<script lang="ts">
	import Appearance from './Appearance.svelte'
	import Servers from './servers'
</script>

<div class="bg-background min-h-svh">
	<header class="border-b">
		<div class="mx-auto flex h-14 max-w-3xl items-center px-6">
			<p class="text-lg font-semibold tracking-tight">dadict</p>
		</div>
	</header>

	<main class="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-8">
		<Servers />
		<Appearance />
	</main>
</div>
