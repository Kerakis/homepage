<script lang="ts">
	// Update this to Svelte 5 - this seems to be a problem for some reason
	import { onMount, onDestroy, createEventDispatcher, tick } from 'svelte';
	export let bird: any;
	export let detections: Array<{ timestamp: string; soundscape: { url: string } }> = [];
	export let loading = false;
	export let wikiSummary = '';
	export let wikiUrl = '';
	export let ebirdUrl = '';
	const dispatch = createEventDispatcher();

	let showAudio: Record<number, boolean> = {};
	let audioRefs: Array<HTMLAudioElement | null> = [];
	let currentlyPlaying: number | null = null;
	let audioContexts: Array<AudioContext | null> = [];
	let gainNodes: Array<GainNode | null> = [];

	function handleBackgroundClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			dispatch('close');
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			dispatch('close');
		}
	}

	function playDetection(i: number) {
		showAudio = {};
		showAudio[i] = true;

		audioRefs.forEach((audio, idx) => {
			if (audio && idx !== i) {
				audio.pause();
				audio.currentTime = 0;
			}
		});
		currentlyPlaying = i;

		tick().then(() => {
			const audio = audioRefs[i];
			if (audio) {
				audio.play();
			}
		});
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
	});
	onDestroy(() => {
		window.removeEventListener('keydown', handleKeydown);
		audioContexts.forEach((ctx) => ctx && ctx.close());
	});
</script>

{#if bird}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
		on:click={handleBackgroundClick}
		on:keydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') dispatch('close');
		}}
		tabindex="0"
		role="dialog"
		aria-modal="true"
	>
		<div class="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg dark:bg-black">
			<button
				class="hover:text-accent-red absolute top-4 right-4 text-2xl text-gray-400"
				on:click={() => dispatch('close')}
				aria-label="Close">&times;</button
			>
			<img
				src={bird.imageUrl}
				alt={bird.commonName}
				class="mx-auto mb-4 h-64 w-64 rounded-2xl object-cover"
			/>
			<h2 class="mb-1 text-center text-2xl font-bold">{bird.commonName}</h2>
			<p class="mb-2 text-center text-gray-500 italic">{bird.scientificName}</p>
			<p class="mb-2 text-center">
				<span class="font-bold">{(bird.detections?.total ?? 0).toLocaleString()}</span> detections
			</p>
			<h3 class="mt-4 mb-2 font-semibold">Last 5 Detections</h3>
			{#if loading}
				<div class="text-accent-red flex flex-col items-center justify-center py-6">
					<svg
						class="text-accent-red mb-4 h-12 w-12 animate-spin"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
					</svg>
					<span>Loading...</span>
				</div>
			{:else}
				<ul class="mb-4 space-y-2">
					{#each detections as det, i}
						<li class="flex items-center gap-2">
							<span class="text-xs text-gray-500">{new Date(det.timestamp).toLocaleString()}</span>
							{#if det.soundscape?.url}
								{#if !showAudio[i]}
									<button
										class="bg-accent-red rounded px-2 py-1 text-xs text-white"
										on:click={() => playDetection(i)}
									>
										▶ Play
									</button>
								{:else}
									<audio
										bind:this={audioRefs[i]}
										src={det.soundscape.url}
										controls
										class="h-6"
										on:play={() => {
											audioRefs.forEach((audio, idx) => {
												if (audio && idx !== i) {
													audio.pause();
													audio.currentTime = 0;
												}
											});
											currentlyPlaying = i;
										}}
									></audio>
								{/if}
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
			{#if wikiSummary}
				<p class="mb-2">{wikiSummary}</p>
			{/if}
			<div class="mt-4 flex justify-center gap-4">
				{#if wikiUrl}
					<a href={wikiUrl} target="_blank" class="text-blue-600 underline">Wikipedia</a>
				{/if}
				{#if ebirdUrl}
					<a href={ebirdUrl} target="_blank" class="text-green-600 underline">eBird</a>
				{/if}
			</div>
		</div>
	</div>
{/if}
