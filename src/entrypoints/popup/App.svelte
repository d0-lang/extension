<script lang="ts">
	import { onMount } from 'svelte'
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
	}
</script>

<main class="flex w-72 flex-col gap-4 p-4">
	<div class="flex items-center justify-between gap-3">
		<Label for="lookup-enabled">Word lookup</Label>
		<Switch
			id="lookup-enabled"
			checked={lookupEnabled}
			onCheckedChange={(checked) => void onToggle(checked)}
		/>
	</div>
	<Button variant="outline" onclick={openSetup}>dadict</Button>
</main>
