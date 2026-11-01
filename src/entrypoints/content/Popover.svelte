<script lang="ts">
	import { onDestroy, untrack } from 'svelte'
	import Play from '@lucide/svelte/icons/play'
	import { groupEntries, isAllowedAudioUrl } from '$lib/dict/entries'
	import type { DictError } from '$lib/dict/errors'
	import type { LookupReply } from '$lib/messages'
	import type { AnchorRect } from './pick'
	import { placePopover } from './position'

	let {
		word,
		anchor,
		dark,
		search,
	}: {
		word: string
		anchor: AnchorRect
		dark: boolean
		/** Unset when `word` cannot be looked up. A language pins that language for this page. */
		search: ((language?: string) => Promise<LookupReply>) | undefined
	} = $props()

	let reply = $state(untrack(() => search?.()))

	let element = $state<HTMLElement>()
	let place = $state({ top: 0, left: 0 })
	let failedAudio = $state<string>()
	let player: HTMLAudioElement | undefined

	const reposition = () => {
		if (element === undefined) {
			return
		}
		const root = document.scrollingElement
		place = placePopover(
			anchor,
			{ width: element.offsetWidth, height: element.offsetHeight },
			{
				width: root?.clientWidth ?? window.innerWidth,
				height: root?.clientHeight ?? window.innerHeight,
			},
		)
	}

	$effect(() => {
		if (element === undefined) {
			return
		}
		const observer = new ResizeObserver(reposition)
		observer.observe(element)
		window.addEventListener('resize', reposition)
		return () => {
			observer.disconnect()
			window.removeEventListener('resize', reposition)
		}
	})

	const play = (url: string) => {
		player?.pause()
		failedAudio = undefined
		const next = new Audio(url)
		player = next
		void next.play().catch(() => {
			if (player === next) {
				failedAudio = url
			}
		})
	}

	onDestroy(() => {
		player?.pause()
		player = undefined
	})

	const errorText = (error: DictError): string => {
		switch (error.kind) {
			case 'no-server':
				return 'No dictionary server is set up. Click the extension icon to add one.'
			case 'network':
				return 'Could not reach the dictionary server.'
			case 'http':
				return 'The dictionary server returned an error.'
			case 'bad-request':
				return 'The dictionary server rejected this request.'
			case 'unsupported-lang':
				return 'The dictionary server does not support this language.'
			default:
				return 'The dictionary server sent an unexpected response.'
		}
	}
</script>

<div
	bind:this={element}
	class={[
		'dict-popover bg-popover text-popover-foreground fixed flex flex-col rounded-lg border font-sans text-sm shadow-lg',
		dark && 'dark',
	]}
	style:top="{place.top}px"
	style:left="{place.left}px"
	role="dialog"
	aria-label="Dictionary lookup"
>
	{#if reply === undefined}
		<p class="text-muted-foreground p-3">
			{word === '' ? 'No word found here. Select one and try again.' : 'That selection is too long. Select a word or a short phrase.'}
		</p>
	{:else}
		{#await reply}
			<p class="text-muted-foreground p-3" role="status">Looking up {word}…</p>
		{:then result}
			{#if result.languages.length > 1}
				<div class="flex flex-wrap gap-1 border-b p-2">
					{#each result.languages as language (language)}
						{@const active = result.ok && result.lang === language}
						<button
							type="button"
							class={[
								'hover:bg-muted h-6 cursor-pointer rounded-md px-2 text-xs font-medium',
								active && 'bg-secondary text-secondary-foreground',
							]}
							aria-pressed={active}
							onclick={() => (reply = search?.(language))}
						>
							{language}
						</button>
					{/each}
				</div>
			{/if}
			{#if !result.ok}
				<p class="text-destructive p-3 wrap-anywhere" role="alert">{errorText(result.error)}</p>
			{:else if result.entries.length === 0}
				<p class="text-muted-foreground p-3 wrap-anywhere">No entries for {word}.</p>
			{:else}
				<div class="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain p-3">
					{#each groupEntries(result.entries) as group, index (index)}
						{@const audio = group.audio.find(isAllowedAudioUrl)}
						<section class="flex flex-col gap-1">
							<div class="flex items-center gap-2">
								<h2 class="min-w-0 text-base font-semibold wrap-anywhere">{group.lemma}</h2>
								<span class="text-muted-foreground shrink-0 text-xs">{group.pos}</span>
								{#if audio !== undefined}
									<button
											type="button"
											class="hover:bg-muted ml-auto inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md disabled:cursor-default disabled:opacity-50"
											aria-label="Play pronunciation of {group.lemma}"
											title={failedAudio === audio ? 'Could not play this audio' : 'Play pronunciation'}
											disabled={failedAudio === audio}
											onclick={() => play(audio)}
										>
											<Play class="size-3" />
										</button>
								{/if}
							</div>
							{#if group.readings.length > 0}
								<p class="wrap-anywhere">{group.readings.join(', ')}</p>
							{/if}
							{#if group.ipa.length > 0}
								<p class="text-muted-foreground text-xs wrap-anywhere">{group.ipa.join(' ')}</p>
							{/if}
							<ol class="flex list-decimal flex-col gap-1 pl-5">
								{#each group.senses as sense, senseIndex (senseIndex)}
									<li class="wrap-anywhere">{sense.translations.join('; ')}</li>
								{/each}
							</ol>
						</section>
					{/each}
				</div>
			{/if}
		{/await}
	{/if}
</div>
