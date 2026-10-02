<script lang="ts">
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert'
	import { Button } from '$lib/components/ui/button'
	import { Checkbox } from '$lib/components/ui/checkbox'
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle,
	} from '$lib/components/ui/dialog'
	import { Label } from '$lib/components/ui/label'
	import type { ServerMeta } from '$lib/dict'
	import { normalizeServerUrl, type ServerByLang } from '$lib/storage'

	let {
		open,
		saving,
		url,
		meta,
		serverByLang,
		selected = $bindable(),
		genericError,
		onok,
		onclose,
	}: {
		open: boolean
		saving: boolean
		url: string
		meta: ServerMeta
		serverByLang: ServerByLang
		selected: Record<string, boolean>
		genericError: string
		onok: () => void
		onclose: () => void
	} = $props()

	const selectedLanguages = $derived(
		Object.entries(selected)
			.filter(([, on]) => on)
			.map(([lang]) => lang),
	)
</script>

<Dialog
	{open}
	onOpenChange={(next) => {
		if (!next) {
			onclose()
		}
	}}
>
	<DialogContent class="max-h-[90svh] overflow-y-auto sm:max-w-md">
		<DialogHeader>
			<DialogTitle>Server</DialogTitle>
			<DialogDescription>
				The server at {normalizeServerUrl(url)} is:
			</DialogDescription>
		</DialogHeader>
		<div class="flex flex-col gap-3">
			<div>
				<p class="text-sm font-medium">Name</p>
				<p>{meta.name}</p>
			</div>
			<div>
				<p class="text-sm font-medium">Languages</p>
				{#if meta.languages.length === 0}
					<p class="text-muted-foreground text-sm">None advertised</p>
				{:else}
					<ul class="mt-2 flex flex-col gap-2">
						{#each meta.languages as lang (lang)}
							<li class="flex items-center gap-2">
								<Checkbox id={`lang-${lang}`} bind:checked={selected[lang]} />
								<Label for={`lang-${lang}`}>
									{lang} ({lang in serverByLang ? 'in use' : 'not in use'})
								</Label>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
			<div>
				<p class="text-sm font-medium">URLs</p>
				{#if meta.verification_urls.length === 0}
					<p class="text-muted-foreground text-sm">None</p>
				{:else}
					<ul class="mt-1 list-disc pl-4">
						{#each meta.verification_urls as href (href)}
							<li>
								<a class="underline" href={href} target="_blank" rel="noreferrer">{href}</a>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
		{#if genericError}
			<Alert variant="destructive">
				<AlertTitle>Could not save</AlertTitle>
				<AlertDescription>{genericError}</AlertDescription>
			</Alert>
		{/if}
		<DialogFooter>
			<Button onclick={onok} disabled={saving || selectedLanguages.length === 0}>
				{saving ? 'Saving…' : 'OK'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
