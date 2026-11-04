<script lang="ts">
	import { onMount } from 'svelte'
	import SettingsIcon from '@lucide/svelte/icons/settings'
	import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert'
	import { Button } from '$lib/components/ui/button'
	import { Label } from '$lib/components/ui/label'
	import { Switch } from '$lib/components/ui/switch'
	import {
		getContextEnabled,
		getLookupEnabled,
		getServerIssues,
		setContextEnabled,
		setLookupEnabled,
	} from '$lib/storage'

	let lookupEnabled = $state(false)
	let issueCount = $state(0)
	/** Host of the active tab. Unset on pages the content script cannot run on. */
	let host = $state<string>()
	let contextEnabled = $state(false)

	const activeHost = async (): Promise<string | undefined> => {
		const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
		const url = URL.parse(tab?.url ?? '')
		return url !== null && (url.protocol === 'https:' || url.protocol === 'http:') ? url.hostname : undefined
	}

	onMount(async () => {
		const [enabled, issues, tabHost] = await Promise.all([getLookupEnabled(), getServerIssues(), activeHost()])
		lookupEnabled = enabled
		issueCount = Object.keys(issues).length
		host = tabHost
		if (tabHost !== undefined) {
			contextEnabled = await getContextEnabled(tabHost)
		}
	})

	const onToggle = async (checked: boolean) => {
		lookupEnabled = checked
		await setLookupEnabled(checked)
	}

	const onContextToggle = async (checked: boolean) => {
		if (host === undefined) {
			return
		}
		contextEnabled = checked
		await setContextEnabled(host, checked)
	}

	const openSetup = () => {
		void browser.tabs.create({ url: browser.runtime.getURL('/setup.html') })
		window.close()
	}
</script>

<main class="flex w-60 flex-col gap-4 p-4">
	<div class="flex items-center justify-between gap-4">
		<Label for="lookup-enabled" class="text-lg">Word lookup</Label>
		<Switch
			id="lookup-enabled"
			checked={lookupEnabled}
			onCheckedChange={(checked) => void onToggle(checked)}
		/>
	</div>
	{#if host !== undefined}
		<div class="flex items-center justify-between gap-4">
			<div class="flex min-w-0 flex-col gap-0.5">
				<Label for="context-enabled">Send sentences</Label>
				<p class="text-muted-foreground truncate text-xs" title={host}>on {host}</p>
			</div>
			<Switch
				id="context-enabled"
				checked={contextEnabled}
				onCheckedChange={(checked) => void onContextToggle(checked)}
			/>
		</div>
	{/if}
	{#if issueCount > 0}
		<button
			type="button"
			class="bg-destructive/10 text-destructive hover:bg-destructive/20 flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm"
			onclick={openSetup}
		>
			<ShieldAlertIcon class="size-4 shrink-0" />
			{issueCount === 1 ? 'A server needs' : `${issueCount} servers need`} your attention.
		</button>
	{/if}
	<Button variant="outline" size="lg" class="text-base" onclick={openSetup}>
		<SettingsIcon />
		Settings
	</Button>
</main>
