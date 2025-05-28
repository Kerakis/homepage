<script lang="ts">
	// Update this to Svelte 5 - this seems to be a problem for some reason
	import { onMount, onDestroy, createEventDispatcher, tick } from 'svelte';
	export let bird: any;
	export let detections: Array<{ timestamp: string; soundscape: { url: string } }> = [];
	export let loading = false;
	export let wikiSummary = '';
	export let wikiUrl = '';
	export let ebirdUrl = '';
	export let detections24h: number | null = 0;
	export let detectionsAllTime: number = 0;
	export let detections24hLoading: boolean = false;
	const dispatch = createEventDispatcher();

	let showAudio: Record<number, boolean> = {};
	let audioRefs: Array<HTMLAudioElement | null> = [];
	let currentlyPlaying: number | null = null;

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
		// Reset all showAudio states
		const newShowAudio: Record<number, boolean> = {}; // Keep as is for now, TS error handled separately
		for (const key in showAudio) {
			newShowAudio[key] = false; // Keep as is
		}
		newShowAudio[i] = true; // Keep as is
		showAudio = newShowAudio;

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
				audio.play().catch((e) => console.error('Error playing audio:', e));
			}
		});
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		const modalRoot = document.querySelector('[role="dialog"]');
		if (modalRoot instanceof HTMLElement) {
			modalRoot.focus();
		}
		document.body.classList.add('overflow-hidden'); // Prevent background scroll
	});

	onDestroy(() => {
		window.removeEventListener('keydown', handleKeydown);
		audioRefs.forEach((audio) => {
			if (audio) {
				audio.pause();
				audio.src = '';
			}
		});
		document.body.classList.remove('overflow-hidden'); // Restore background scroll
	});
</script>

{#if bird}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
		on:click={handleBackgroundClick}
		tabindex="0"
		role="dialog"
		aria-modal="true"
		aria-labelledby="bird-modal-title"
		on:keydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				dispatch('close');
			}
		}}
	>
		<div
			class="relative flex w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-neutral-800"
		>
			<div class="p-6">
				<button
					class="absolute top-3 right-3 z-10 rounded-full bg-white/60 p-1.5 text-gray-500 transition-colors duration-150 hover:bg-gray-200 hover:text-gray-700 dark:bg-neutral-700/60 dark:text-neutral-300 dark:hover:bg-neutral-600 dark:hover:text-white"
					on:click={() => dispatch('close')}
					aria-label="Close modal"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>

				<div class="mb-4 aspect-[4/3] w-full overflow-hidden rounded-lg">
					<img src={bird.imageUrl} alt={bird.commonName} class="h-full w-full object-cover" />
				</div>

				<h2 id="bird-modal-title" class="mb-1 text-center text-2xl font-bold dark:text-white">
					{bird.commonName}
				</h2>
				<p class="mb-2 text-center text-sm text-gray-500 italic dark:text-neutral-400">
					{bird.scientificName}
				</p>
				<p class="mb-4 text-center text-sm text-gray-600 dark:text-neutral-300">
					<span class="font-bold">
						{#if detections24hLoading}
							<span
								class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent align-middle"
							></span>
						{:else if detections24h !== null && detections24h !== undefined}
							{detections24h.toLocaleString()}
						{:else}
							—
						{/if}
					</span>
					detections in last 24h
					<br />
					<span class="font-bold">{detectionsAllTime.toLocaleString()}</span> detections all time
				</p>

				{#if wikiSummary}
					<div class="mb-4">
						<h3 class="mb-1.5 text-sm font-semibold text-gray-700 dark:text-neutral-200">
							About this bird:
						</h3>
						<p
							class="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 dark:scrollbar-thumb-neutral-500 dark:scrollbar-track-neutral-700 max-h-36 overflow-y-auto rounded-md bg-gray-50 p-2.5 text-xs leading-relaxed text-gray-700 dark:bg-neutral-700/50 dark:text-neutral-300"
						>
							{wikiSummary}
						</p>
					</div>
				{/if}

				<h3 class="mb-2 text-sm font-semibold text-gray-700 dark:text-neutral-200">
					Recent Detections:
				</h3>
				{#if loading}
					<div
						class="flex flex-col items-center justify-center py-6 text-sm text-gray-500 dark:text-neutral-400"
					>
						<svg
							class="text-accent-red dark:text-accent-red-dark mb-2 h-8 w-8 animate-spin"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V8H4z"></path>
						</svg>
						<span>Loading sounds...</span>
					</div>
				{:else if detections.length > 0}
					<ul
						class="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 dark:scrollbar-thumb-neutral-500 dark:scrollbar-track-neutral-700 mb-4 max-h-32 space-y-1.5 overflow-y-auto pr-1"
					>
						{#each detections as det, i}
							<li
								class="flex items-center justify-between gap-2 rounded-md bg-gray-50 p-2 dark:bg-neutral-700/50"
							>
								<span class="text-xs text-gray-500 dark:text-neutral-400"
									>{new Date(det.timestamp).toLocaleString([], {
										dateStyle: 'short',
										timeStyle: 'short'
									})}</span
								>
								{#if det.soundscape?.url}
									{#if !showAudio[i]}
										<button
											class="bg-accent-red hover:bg-accent-red-dark rounded px-2.5 py-1 text-xs text-white transition-colors"
											on:click={() => playDetection(i)}
											aria-label={`Play sound from ${new Date(det.timestamp).toLocaleString()}`}
										>
											▶ Play
										</button>
									{:else}
										<audio
											bind:this={audioRefs[i]}
											src={det.soundscape.url}
											controls
											class="h-7 w-full max-w-[200px] sm:max-w-[250px]"
											on:play={() => {
												audioRefs.forEach((audio, idx) => {
													if (audio && idx !== i) {
														audio.pause();
														audio.currentTime = 0;
													}
												});
												currentlyPlaying = i;
											}}
											on:ended={() => (showAudio[i] = false)}
										></audio>
									{/if}
								{/if}
							</li>
						{:else}
							<li class="py-2 text-center text-xs text-gray-500 dark:text-neutral-400">
								No recent sound detections available.
							</li>
						{/each}
					</ul>
				{:else}
					<p class="py-2 text-center text-xs text-gray-500 dark:text-neutral-400">
						No recent sound detections available.
					</p>
				{/if}
			</div>

			{#if wikiUrl || ebirdUrl}
				<div
					class="mt-auto border-t border-gray-200 bg-gray-50 px-6 py-3 dark:border-neutral-700 dark:bg-neutral-800/50"
				>
					<div class="flex items-center justify-center gap-4">
						{#if wikiUrl}
							<a
								href={wikiUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="rounded-md px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:text-neutral-200 dark:hover:bg-neutral-700"
							>
								Wikipedia
							</a>
						{/if}
						{#if ebirdUrl}
							<a
								href={ebirdUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="rounded-md px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:text-neutral-200 dark:hover:bg-neutral-700"
							>
								eBird
							</a>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
