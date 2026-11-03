<script lang="ts">
	import { onMount } from 'svelte'
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis'
	import LanguagesIcon from '@lucide/svelte/icons/languages'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert'
	import Trash2Icon from '@lucide/svelte/icons/trash-2'
	import { Button } from '$lib/components/ui/button'
	import {
		ContextMenu,
		ContextMenuContent,
		ContextMenuItem,
		ContextMenuTrigger,
	} from '$lib/components/ui/context-menu'
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger,
	} from '$lib/components/ui/dropdown-menu'
	import { pairName } from '$lib/languages'
	import { ServerSetup } from '../ServerSetup.svelte'
	import RemoveDialog from './RemoveDialog.svelte'
	import ServerDialog from './ServerDialog.svelte'

	const servers = new ServerSetup()

	onMount(() => {
		void servers.load()
		return servers.watch()
	})
</script>

<section class="flex flex-col gap-4">
	{#if servers.rows.length === 0}
		<div class="flex flex-col items-center gap-4 rounded-xl border border-dashed p-8 text-center">
			<div class="flex flex-col gap-1">
				<h2 class="text-lg font-semibold">Add a dictionary server to start</h2>
				<p class="text-muted-foreground text-sm">
					Words are looked up on servers you choose. Nothing is sent anywhere until you add one.
				</p>
			</div>
			<Button onclick={servers.openAdd}>
				<PlusIcon />
				Add server
			</Button>
			<ol class="mt-2 grid w-full gap-3 text-left sm:grid-cols-3">
				<li class="bg-muted/50 flex flex-col gap-1 rounded-lg p-3">
					<span class="text-muted-foreground text-xs">1</span>
					<p class="text-sm font-medium">Connect</p>
					<p class="text-muted-foreground text-sm">Paste the server URL.</p>
				</li>
				<li class="bg-muted/50 flex flex-col gap-1 rounded-lg p-3">
					<span class="text-muted-foreground text-xs">2</span>
					<p class="text-sm font-medium">Pick languages</p>
					<p class="text-muted-foreground text-sm">Choose which pairs this server answers.</p>
				</li>
				<li class="bg-muted/50 flex flex-col gap-1 rounded-lg p-3">
					<span class="text-muted-foreground text-xs">3</span>
					<p class="text-sm font-medium">Look up</p>
					<p class="text-muted-foreground text-sm">
						Hold <kbd class="rounded border px-1 text-xs">Alt</kbd> over a word, or right-click and
						choose Look up.
					</p>
				</li>
			</ol>
		</div>
	{:else}
		<div class="flex items-center justify-between gap-4">
			<div class="flex flex-col gap-0.5">
				<h2 class="text-base font-medium">Servers</h2>
				<p class="text-muted-foreground text-sm">Each language is answered by one server.</p>
			</div>
			<Button size="sm" onclick={servers.openAdd}>
				<PlusIcon />
				Add
			</Button>
		</div>
		<ul class="flex flex-col gap-3">
			{#each servers.rows as row (row.url)}
				<li>
					<ContextMenu>
						<ContextMenuTrigger
							class={[
								'bg-card flex items-start gap-3 rounded-lg border p-4 select-text',
								row.issue !== undefined && 'border-destructive/50',
							]}
						>
							<div class="flex min-w-0 flex-1 flex-col gap-3">
								<div class="flex min-w-0 flex-col gap-0.5">
									<p class="font-medium">{row.name}</p>
									<p class="text-muted-foreground truncate font-mono text-xs">{row.url}</p>
								</div>
								{#if row.issue !== undefined}
									<div
										class="bg-destructive/10 text-destructive flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md px-3 py-2 text-sm"
									>
										<ShieldAlertIcon class="size-4 shrink-0" />
										<p class="min-w-0 flex-1">
											{row.issue === 'identity'
												? 'Its signing key changed. Review it before you trust it.'
												: 'Its answer failed the signature check at the last start.'}
										</p>
										<Button variant="outline" size="xs" onclick={() => servers.openEdit(row)}>
											{row.issue === 'identity' ? 'Review' : 'Check again'}
										</Button>
									</div>
								{/if}
								{#if row.languages.length === 0}
									<p class="text-muted-foreground text-sm">No languages selected</p>
								{:else}
									<ul class="flex flex-wrap gap-1.5">
										{#each row.languages as lang (lang)}
											{@const unoffered = row.unoffered.includes(lang)}
											<li
												class={[
													'bg-muted rounded-full px-2.5 py-0.5 text-xs',
													unoffered && 'text-muted-foreground line-through',
												]}
												title={unoffered ? `${lang}: no longer offered by this server` : lang}
											>
												{pairName(lang)}
											</li>
										{/each}
									</ul>
								{/if}
							</div>
							<DropdownMenu>
								<DropdownMenuTrigger>
									{#snippet child({ props })}
										<Button
											{...props}
											variant="ghost"
											size="icon-sm"
											aria-label="Actions for {row.name}"
										>
											<EllipsisIcon />
										</Button>
									{/snippet}
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" class="min-w-40">
									<DropdownMenuItem onSelect={() => servers.openEdit(row)}>
										<LanguagesIcon />
										Edit languages
									</DropdownMenuItem>
									<DropdownMenuItem variant="destructive" onSelect={() => servers.askRemove(row)}>
										<Trash2Icon />
										Remove
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</ContextMenuTrigger>
						<ContextMenuContent class="min-w-40">
							<ContextMenuItem onSelect={() => servers.openEdit(row)}>
								<LanguagesIcon />
								Edit languages
							</ContextMenuItem>
							<ContextMenuItem variant="destructive" onSelect={() => servers.askRemove(row)}>
								<Trash2Icon />
								Remove
							</ContextMenuItem>
						</ContextMenuContent>
					</ContextMenu>
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if servers.dialogState !== 'closed'}
	<ServerDialog setup={servers} />
{/if}

<RemoveDialog setup={servers} />
