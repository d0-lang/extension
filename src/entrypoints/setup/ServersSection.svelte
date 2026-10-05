<script lang="ts">
	import { onMount } from 'svelte'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import { Button } from '$lib/components/ui/button'
	import { Separator } from '$lib/components/ui/separator'
	import type { ServerMeta } from '$lib/dict'
	import { ResultAsync } from 'neverthrow'
	import { bindServer, getServerByLang, getServers, type ServerByLang } from '$lib/storage'
	import AddServerDialog from './AddServerDialog.svelte'
	import ReviewServerDialog from './ReviewServerDialog.svelte'
	import type { DialogState, ServerRow } from './types'

	let rows = $state.raw<Array<ServerRow>>([])
	let serverByLang = $state.raw<ServerByLang>({})
	let dialogState = $state<DialogState>('closed')
	let draft = $state.raw<{ url: string; key: string; meta: ServerMeta } | null>(null)
	let selected = $state<Record<string, boolean>>({})
	let genericError = $state('')

	const addOpen = $derived(dialogState === 'add-open')
	const reviewOpen = $derived(dialogState === 'review-open' || dialogState === 'saving')

	const loadRows = async () => {
		const [servers, nextServerByLang] = await Promise.all([getServers(), getServerByLang()])
		serverByLang = nextServerByLang
		rows = Object.entries(nextServerByLang).map(([lang, serverUrl]) => ({
			lang,
			url: serverUrl,
			name: servers[serverUrl]?.name ?? serverUrl,
		}))
	}

	const resetDialog = () => {
		draft = null
		selected = {}
		genericError = ''
		dialogState = 'closed'
	}

	onMount(() => {
		void loadRows()
	})

	const onAdd = () => {
		draft = null
		selected = {}
		genericError = ''
		dialogState = 'add-open'
	}

	const onOk = async () => {
		if (draft === null) {
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
		const result = await bindServer(
			{
				url: draft.url,
				key: draft.key,
				name: draft.meta.name,
				languages: draft.meta.languages,
				verificationUrls: draft.meta.verification_urls,
			},
			selectedLanguages,
		).andThen(() =>
			ResultAsync.fromPromise(
				loadRows(),
				(cause) => (cause instanceof Error ? cause : new Error(String(cause))),
			),
		)
		if (dialogState !== 'saving') {
			return
		}
		if (result.isErr()) {
			dialogState = 'review-open'
			genericError = result.error.message
			return
		}
		resetDialog()
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

{#if addOpen}
	<AddServerDialog
		open
		onsuccess={(result) => {
			if (dialogState !== 'add-open') {
				return
			}
			draft = result
			selected = Object.fromEntries(result.meta.languages.map((lang) => [lang, false]))
			dialogState = 'review-open'
		}}
		onclose={() => {
			if (dialogState === 'add-open') {
				resetDialog()
			}
		}}
	/>
{/if}

{#if draft}
	<ReviewServerDialog
		open={reviewOpen}
		saving={dialogState === 'saving'}
		url={draft.url}
		meta={draft.meta}
		{serverByLang}
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
