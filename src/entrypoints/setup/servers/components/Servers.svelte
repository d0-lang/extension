<script lang="ts">
	import { onMount } from 'svelte'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import { Button } from '$lib/components/ui/button'
	import { Separator } from '$lib/components/ui/separator'
	import { ServerSetup } from '../ServerSetup.svelte'
	import AddDialog from './AddDialog.svelte'
	import ReviewDialog from './ReviewDialog.svelte'

	const servers = new ServerSetup()

	onMount(() => {
		void servers.load()
	})
</script>

<section class="flex flex-col gap-4">
	<div class="flex items-center justify-between gap-4">
		<h1 class="text-base font-medium">Servers</h1>
		<Button size="sm" onclick={servers.openAdd}>
			<PlusIcon />
			Add
		</Button>
	</div>
	<Separator />
	{#if servers.rows.length === 0}
		<p class="text-muted-foreground text-sm">No servers yet.</p>
	{:else}
		<ul class="flex flex-col">
			{#each servers.rows as row (row.lang)}
				<li class="flex items-baseline justify-between gap-4 border-b py-3 last:border-b-0">
					<div class="flex min-w-0 flex-col gap-0.5">
						<p class="font-medium">{row.name}</p>
						<p class="text-muted-foreground truncate text-sm">{row.url}</p>
					</div>
					<p class="text-muted-foreground shrink-0 text-sm">{row.lang}</p>
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if servers.addOpen}
	<AddDialog setup={servers} />
{/if}

{#if servers.draft}
	<ReviewDialog setup={servers} />
{/if}
