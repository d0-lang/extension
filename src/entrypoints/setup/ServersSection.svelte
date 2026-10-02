<script lang="ts">
	import { onMount } from 'svelte'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import { Button } from '$lib/components/ui/button'
	import { Separator } from '$lib/components/ui/separator'
	import { DEFAULT_BASE_URL, HandshakeError, connect, type ServerMeta } from '$lib/dict'
	import {
		bindServer,
		getDefaults,
		getServers,
		normalizeServerUrl,
		type Defaults,
	} from '$lib/storage'
	import AddServerDialog from './AddServerDialog.svelte'
	import ReviewServerDialog from './ReviewServerDialog.svelte'
	import type { DialogState, ServerRow } from './types'

	let rows = $state.raw<Array<ServerRow>>([])
	let defaults = $state.raw<Defaults>({})
	let dialogState = $state<DialogState>('closed')
	let url = $state(DEFAULT_BASE_URL)
	let key = $state('')
	let meta = $state.raw<ServerMeta | null>(null)
	let selected = $state<Record<string, boolean>>({})
	let genericError = $state('')
	let identityUrls = $state.raw<Array<string> | null>(null)
	let pendingKey = $state<string | undefined>(undefined)
	let identityLocked = $state(false)
	let identityLockTimer: ReturnType<typeof setTimeout> | undefined

	const addOpen = $derived(dialogState === 'add-open' || dialogState === 'connecting')
	const reviewOpen = $derived(dialogState === 'review-open' || dialogState === 'saving')

	const clearIdentityLock = () => {
		if (identityLockTimer !== undefined) {
			clearTimeout(identityLockTimer)
			identityLockTimer = undefined
		}
		identityLocked = false
	}

	const startIdentityLock = () => {
		clearIdentityLock()
		identityLocked = true
		identityLockTimer = setTimeout(() => {
			identityLocked = false
			identityLockTimer = undefined
		}, 5000)
	}

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
		key = ''
		meta = null
		selected = {}
		genericError = ''
		identityUrls = null
		pendingKey = undefined
		clearIdentityLock()
		dialogState = 'closed'
	}

	onMount(() => {
		void loadRows()
	})

	const onAdd = () => {
		resetDialog()
		dialogState = 'add-open'
	}

	const finishHandshake = (result: { key: string; meta: ServerMeta }) => {
		if (dialogState !== 'connecting') {
			return
		}
		key = result.key
		meta = result.meta
		selected = Object.fromEntries(result.meta.languages.map((lang) => [lang, false]))
		dialogState = 'review-open'
	}

	const failHandshake = (cause: unknown) => {
		if (dialogState !== 'connecting') {
			return
		}
		dialogState = 'add-open'
		if (cause instanceof HandshakeError && cause.kind === 'identity') {
			identityUrls = cause.verificationUrls
			pendingKey = cause.newKey
			startIdentityLock()
			return
		}
		identityUrls = null
		pendingKey = undefined
		clearIdentityLock()
		if (cause instanceof HandshakeError) {
			genericError = 'Handshake failed.'
		} else {
			genericError = cause instanceof Error ? cause.message : String(cause)
		}
	}

	const onConnect = async () => {
		dialogState = 'connecting'
		genericError = ''
		identityUrls = null
		pendingKey = undefined
		clearIdentityLock()
		meta = null
		key = ''
		selected = {}
		try {
			finishHandshake(await connect(url))
		} catch (cause) {
			failHandshake(cause)
		}
	}

	const onContinue = async () => {
		dialogState = 'connecting'
		genericError = ''
		meta = null
		key = ''
		selected = {}
		try {
			finishHandshake(await connect(url, pendingKey))
		} catch (cause) {
			failHandshake(cause)
		}
	}

	const onOk = async () => {
		if (meta === null) {
			return
		}
		const selectedLanguages = Object.entries(selected)
			.filter(([, on]) => on)
			.map(([lang]) => lang)
		if (selectedLanguages.length === 0) {
			return
		}
		dialogState = 'saving'
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
			if (dialogState !== 'saving') {
				return
			}
			dialogState = 'review-open'
			genericError = cause instanceof Error ? cause.message : String(cause)
		}
	}
</script>

<section class="flex flex-col gap-4">
	<div class="flex items-center justify-between gap-4">
		<h1 class="text-base font-medium">Servers</h1>
		<Button size="sm" onclick={onAdd}>
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
</section>

<AddServerDialog
	open={addOpen}
	connecting={dialogState === 'connecting'}
	bind:url
	{genericError}
	{identityUrls}
	{identityLocked}
	onconnect={() => void onConnect()}
	oncontinue={() => void onContinue()}
	onclose={() => {
		if (dialogState === 'add-open' || dialogState === 'connecting') {
			resetDialog()
		}
	}}
/>

{#if meta}
	<ReviewServerDialog
		open={reviewOpen}
		saving={dialogState === 'saving'}
		{url}
		{meta}
		{defaults}
		bind:selected
		{genericError}
		onok={() => void onOk()}
		onclose={() => {
			if (dialogState === 'review-open' || dialogState === 'saving') {
				resetDialog()
			}
		}}
	/>
{/if}
