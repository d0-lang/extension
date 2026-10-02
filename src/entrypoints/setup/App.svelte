<script lang="ts">
	import { onMount } from 'svelte'
	import PlusIcon from '@lucide/svelte/icons/plus'
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
	import { Input } from '$lib/components/ui/input'
	import { Label } from '$lib/components/ui/label'
	import { Separator } from '$lib/components/ui/separator'
	import { DEFAULT_BASE_URL, HandshakeError, connect, type ServerMeta } from '$lib/dict'
	import {
		bindServer,
		getDefaults,
		getServers,
		normalizeServerUrl,
		type Defaults,
	} from '$lib/storage'

	type ServerRow = {
		lang: string
		name: string
		url: string
	}

	let rows = $state.raw<Array<ServerRow>>([])
	let defaults = $state.raw<Defaults>({})
	let addOpen = $state(false)
	let reviewOpen = $state(false)
	let url = $state(DEFAULT_BASE_URL)
	let connecting = $state(false)
	let saving = $state(false)
	let key = $state('')
	let meta = $state.raw<ServerMeta | null>(null)
	let selected = $state<Record<string, boolean>>({})
	let genericError = $state('')
	let identityUrls = $state.raw<Array<string> | null>(null)

	const selectedLanguages = $derived(
		Object.entries(selected)
			.filter(([, on]) => on)
			.map(([lang]) => lang),
	)

	const loadRows = async () => {
		const [servers, nextDefaults] = await Promise.all([getServers(), getDefaults()])
		defaults = nextDefaults
		rows = Object.entries(nextDefaults).map(([lang, serverUrl]) => ({
			lang,
			url: serverUrl,
			name: servers[serverUrl]?.name ?? serverUrl,
		}))
	}

	const resetDialog = () => {
		url = DEFAULT_BASE_URL
		connecting = false
		saving = false
		key = ''
		meta = null
		selected = {}
		genericError = ''
		identityUrls = null
		addOpen = false
		reviewOpen = false
	}

	onMount(() => {
		void loadRows()
	})

	const onConnect = async () => {
		connecting = true
		genericError = ''
		identityUrls = null
		meta = null
		key = ''
		selected = {}
		try {
			const result = await connect(url)
			key = result.key
			meta = result.meta
			selected = Object.fromEntries(result.meta.languages.map((lang) => [lang, false]))
			reviewOpen = true
			addOpen = false
		} catch (cause) {
			if (cause instanceof HandshakeError && cause.kind === 'identity') {
				identityUrls = cause.verificationUrls
			} else if (cause instanceof HandshakeError) {
				genericError = 'Handshake failed.'
			} else {
				genericError = cause instanceof Error ? cause.message : String(cause)
			}
		} finally {
			connecting = false
		}
	}

	const onOk = async () => {
		if (meta === null || selectedLanguages.length === 0) {
			return
		}
		saving = true
		genericError = ''
		try {
			await bindServer(
				{
					url: normalizeServerUrl(url),
					key,
					name: meta.name,
					languages: meta.languages,
					verificationUrls: meta.verification_urls,
				},
				selectedLanguages,
			)
			await loadRows()
			resetDialog()
		} catch (cause) {
			genericError = cause instanceof Error ? cause.message : String(cause)
		} finally {
			saving = false
		}
	}
</script>

<div class="bg-background min-h-svh">
	<header class="border-b">
		<div class="mx-auto flex h-14 max-w-3xl items-center px-6">
			<p class="text-lg font-semibold tracking-tight">dadict</p>
		</div>
	</header>

	<main class="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-8">
		<div class="flex items-center justify-between gap-4">
			<h1 class="text-base font-medium">Servers</h1>
			<Button
				size="sm"
				onclick={() => {
					resetDialog()
					addOpen = true
				}}
			>
				<PlusIcon />
				Add
			</Button>
		</div>
		<Separator />
		{#if rows.length === 0}
			<p class="text-muted-foreground text-sm">No servers yet.</p>
		{:else}
			<ul class="flex flex-col">
				{#each rows as row (row.lang)}
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
	</main>
</div>

<Dialog
	bind:open={addOpen}
	onOpenChange={(open) => {
		if (!open && meta === null) {
			resetDialog()
		}
	}}
>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>Add server</DialogTitle>
			<DialogDescription>Paste a dictionary server URL and connect.</DialogDescription>
		</DialogHeader>
		<form
			class="flex flex-col gap-3"
			onsubmit={(event) => {
				event.preventDefault()
				void onConnect()
			}}
		>
			<div class="flex flex-col gap-2">
				<Label for="server-url">Server URL</Label>
				<Input id="server-url" type="url" autocomplete="off" spellcheck="false" bind:value={url} />
			</div>
			<Button type="submit" disabled={connecting}>
				{connecting ? 'Connecting…' : 'Connect'}
			</Button>
		</form>

		{#if genericError}
			<Alert variant="destructive">
				<AlertTitle>Handshake failed</AlertTitle>
				<AlertDescription>{genericError}</AlertDescription>
			</Alert>
		{/if}

		{#if identityUrls}
			<Alert variant="destructive">
				<AlertTitle>Server identity may have changed</AlertTitle>
				<AlertDescription>
					<p>Do not trust this response. Check a verification page from the last successful bind:</p>
					<ul class="mt-2 list-disc pl-4">
						{#each identityUrls as href (href)}
							<li>
								<a class="underline" href={href} target="_blank" rel="noreferrer">{href}</a>
							</li>
						{/each}
					</ul>
				</AlertDescription>
			</Alert>
		{/if}
	</DialogContent>
</Dialog>

<Dialog
	bind:open={reviewOpen}
	onOpenChange={(open) => {
		if (!open) {
			resetDialog()
		}
	}}
>
	<DialogContent class="max-h-[90svh] overflow-y-auto sm:max-w-md">
		{#if meta}
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
										{lang} ({lang in defaults ? 'in use' : 'not in use'})
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
				<Button onclick={() => void onOk()} disabled={saving || selectedLanguages.length === 0}>
					{saving ? 'Saving…' : 'OK'}
				</Button>
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>
