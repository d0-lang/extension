<script lang="ts">
	import { onMount } from 'svelte'
	import SettingsIcon from '@lucide/svelte/icons/settings'
	import { Button } from '$lib/components/ui/button'
	import { Label } from '$lib/components/ui/label'
	import { Switch } from '$lib/components/ui/switch'
	import { getLookupEnabled, setLookupEnabled } from '$lib/storage'

	let lookupEnabled = $state(false)

	onMount(async () => {
		lookupEnabled = await getLookupEnabled()
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
	<Button variant="outline" size="sm" onclick={openSetup}>
		<SettingsIcon />
		Settings
	</Button>
</main>
