<script lang="ts">
	import { onMount } from 'svelte'
	import { Kbd } from '$lib/components/ui/kbd'
	import { Label } from '$lib/components/ui/label'
	import { Switch } from '$lib/components/ui/switch'
	import { getLookupEnabled, setLookupEnabled } from '$lib/storage'

	let lookupEnabled = $state(true)

	onMount(() => {
		void getLookupEnabled().then((enabled) => {
			lookupEnabled = enabled
		})
		// The popup can flip lookup while this page is open.
		const onChanged = (changes: Record<string, unknown>, area: string) => {
			if (area === 'local' && 'lookupEnabled' in changes) {
				void getLookupEnabled().then((enabled) => {
					lookupEnabled = enabled
				})
			}
		}
		browser.storage.onChanged.addListener(onChanged)
		return () => browser.storage.onChanged.removeListener(onChanged)
	})

	const onLookup = async (checked: boolean) => {
		lookupEnabled = checked
		await setLookupEnabled(checked)
	}
</script>

<section class="flex flex-col gap-4">
	<h2 class="text-lg font-semibold">Lookup</h2>
	<div class="flex items-center justify-between gap-4 rounded-lg border p-4">
		<div class="flex flex-col gap-0.5">
			<Label for="lookup-enabled">Word lookup</Label>
			<p class="text-muted-foreground text-sm">
				Hold <Kbd>Alt</Kbd> over a word, or right-click and choose Look up.
			</p>
		</div>
		<Switch
			id="lookup-enabled"
			checked={lookupEnabled}
			onCheckedChange={(checked) => void onLookup(checked)}
		/>
	</div>
</section>
