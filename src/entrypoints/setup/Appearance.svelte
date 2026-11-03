<script lang="ts">
	import { onMount } from 'svelte'
	import MonitorIcon from '@lucide/svelte/icons/monitor'
	import MoonIcon from '@lucide/svelte/icons/moon'
	import SunIcon from '@lucide/svelte/icons/sun'
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group'
	import { getTheme, setTheme, type Theme } from '$lib/storage'

	const themes = [
		{ value: 'system', label: 'System', icon: MonitorIcon },
		{ value: 'light', label: 'Light', icon: SunIcon },
		{ value: 'dark', label: 'Dark', icon: MoonIcon },
	] satisfies Array<{ value: Theme; label: string; icon: typeof SunIcon }>

	let theme = $state<Theme>('system')

	onMount(async () => {
		theme = await getTheme()
	})

	const onTheme = async (next: string) => {
		// Pressing the active item deselects it, which leaves no theme.
		const picked = themes.find((option) => option.value === next)
		if (picked === undefined) {
			return
		}
		theme = picked.value
		await setTheme(picked.value)
	}
</script>

<section class="flex flex-col gap-4">
	<h2 class="text-base font-medium">Appearance</h2>
	<div class="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
		<div class="flex flex-col gap-0.5">
			<p class="text-sm font-medium">Theme</p>
			<p class="text-muted-foreground text-sm">Applies to settings and the lookup popover.</p>
		</div>
		<ToggleGroup
			type="single"
			variant="outline"
			size="sm"
			value={theme}
			onValueChange={(next) => void onTheme(next)}
		>
			{#each themes as option (option.value)}
				<ToggleGroupItem value={option.value}>
					<option.icon />
					{option.label}
				</ToggleGroupItem>
			{/each}
		</ToggleGroup>
	</div>
</section>
