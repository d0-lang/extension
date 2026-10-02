<script lang="ts">
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert'
	import { Button } from '$lib/components/ui/button'
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle,
	} from '$lib/components/ui/dialog'
	import { Input } from '$lib/components/ui/input'
	import { Label } from '$lib/components/ui/label'

	let {
		open,
		connecting,
		url = $bindable(),
		genericError,
		identityUrls,
		identityLocked,
		onconnect,
		oncontinue,
		onclose,
	}: {
		open: boolean
		connecting: boolean
		url: string
		genericError: string
		identityUrls: Array<string> | null
		identityLocked: boolean
		onconnect: () => void
		oncontinue: () => void
		onclose: () => void
	} = $props()
</script>

<Dialog
	{open}
	onOpenChange={(next) => {
		if (!next) {
			onclose()
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
				onconnect()
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

		{#if identityUrls !== null}
			<Alert variant="destructive">
				<AlertTitle>Server identity may have changed</AlertTitle>
				<AlertDescription>
					<p>Do not trust this response. Check a verification page from the last successful bind:</p>
					{#if identityUrls.length === 0}
						<p class="text-muted-foreground mt-2 text-sm">None</p>
					{:else}
						<ul class="mt-2 list-disc pl-4">
							{#each identityUrls as href (href)}
								<li>
									<a class="underline" href={href} target="_blank" rel="noreferrer">{href}</a>
								</li>
							{/each}
						</ul>
					{/if}
				</AlertDescription>
			</Alert>
			<Button type="button" disabled={identityLocked || connecting} onclick={oncontinue}>
				{identityLocked ? 'Wait…' : 'Continue'}
			</Button>
		{/if}
	</DialogContent>
</Dialog>
