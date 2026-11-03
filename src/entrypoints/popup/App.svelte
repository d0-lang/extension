<script lang="ts">
	import { onMount } from 'svelte'
	import SettingsIcon from '@lucide/svelte/icons/settings'
	import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert'
	import { Button } from '$lib/components/ui/button'
	import { Label } from '$lib/components/ui/label'
	import { Switch } from '$lib/components/ui/switch'
	import { getLookupEnabled, getServerIssues, setLookupEnabled } from '$lib/storage'

	let lookupEnabled = $state(false)
	let issueCount = $state(0)

	onMount(async () => {
		const [enabled, issues] = await Promise.all([getLookupEnabled(), getServerIssues()])
		lookupEnabled = enabled
		issueCount = Object.keys(issues).length
	})

	const onToggle = async (checked: boolean) => {
		lookupEnabled = checked
		await setLookupEnabled(checked)
	}

	const openSetup = () => {
		void browser.tabs.create({ url: browser.runtime.getURL('/setup.html') })
		window.close()
	}
</script>

<main class="flex w-56 flex-col gap-3 p-3">
	<div class="flex items-center justify-between gap-3">
		<Label for="lookup-enabled">Word lookup</Label>
		<Switch
			id="lookup-enabled"
			checked={lookupEnabled}
			onCheckedChange={(checked) => void onToggle(checked)}
		/>
	</div>
	{#if issueCount > 0}
		<button
			type="button"
			class="bg-destructive/10 text-destructive hover:bg-destructive/20 flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs"
			onclick={openSetup}
		>
			<ShieldAlertIcon class="size-4 shrink-0" />
			{issueCount === 1 ? 'A server needs' : `${issueCount} servers need`} your attention.
		</button>
	{/if}
	<Button variant="outline" size="sm" onclick={openSetup}>
		<SettingsIcon />
		Settings
	</Button>
</main>
