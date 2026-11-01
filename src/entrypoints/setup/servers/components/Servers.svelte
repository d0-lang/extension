<script lang="ts">
	import { onMount } from 'svelte'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import Trash2Icon from '@lucide/svelte/icons/trash-2'
	import { Button } from '$lib/components/ui/button'
	import { Separator } from '$lib/components/ui/separator'
	import { ServerSetup } from '../ServerSetup.svelte'
	import AddDialog from './AddDialog.svelte'
	import RemoveDialog from './RemoveDialog.svelte'
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
	<p class="text-muted-foreground text-sm">
		Lookups use the language detected on the page. If that gives no match among your languages, the
		word may be sent to any server listed here.
	</p>
	<Separator />
	{#if servers.rows.length === 0}
		<p class="text-muted-foreground text-sm">No servers yet.</p>
	{:else}
		<ul class="flex flex-col">
			{#each servers.rows as row (row.url)}
				<li class="flex items-center justify-between gap-4 border-b py-3 last:border-b-0">
					<div class="flex min-w-0 flex-col gap-0.5">
						<p class="font-medium">{row.name}</p>
						<p class="text-muted-foreground truncate text-sm">{row.url}</p>
					</div>
					<div class="flex shrink-0 items-center gap-3">
						<p class="text-muted-foreground text-sm">
							{row.languages.length > 0 ? row.languages.join(', ') : 'No languages'}
						</p>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Remove {row.name}"
							title="Remove"
							onclick={() => servers.askRemove(row)}
						>
							<Trash2Icon />
						</Button>
					</div>
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

<RemoveDialog setup={servers} />
