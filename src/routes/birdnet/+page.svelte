<script lang="ts">
	export let data: { speciesData?: Promise<any> };

	import { birdnetData, loadBirdnetData } from '$lib/stores/birdnet';
	import { fetchDetections } from '$lib/fetchDetections';
	import { writable, derived, type Writable } from 'svelte/store';
	import BirdModal from './BirdModal.svelte';

	let modalOpen = false;
	let modalData: any = null;
	let wikiSummary = '';
	let wikiUrl = '';
	let ebirdUrl = '';

	const speciesStore: Writable<any[]> = writable([]);
	const sortMode = writable<'last' | 'most'>('last');
	const search = writable('');
	const filteredSpecies = derived(
		[speciesStore, sortMode, search],
		([$species, $sortMode, $search]: [any[], string, string]) => {
			let filtered = $species.filter(
				(s: any) =>
					s.commonName.toLowerCase().includes($search.toLowerCase()) ||
					s.scientificName.toLowerCase().includes($search.toLowerCase())
			);
			if ($sortMode === 'last') {
				filtered = filtered.sort(
					(a: any, b: any) =>
						new Date(b.latestDetectionAt).getTime() - new Date(a.latestDetectionAt).getTime()
				);
			} else {
				filtered = filtered.sort(
					(a: any, b: any) => (b.detections?.total ?? 0) - (a.detections?.total ?? 0)
				);
			}
			return filtered;
		},
		[]
	);

	let detectionsCache: Record<
		string,
		Array<{ timestamp: string; soundscape: { url: string } }>
	> = {};
	let detectionsLoading = false;
	let refreshing = false;

	async function openModal(bird: any) {
		modalData = bird;
		modalOpen = true;
		wikiSummary = bird.wikipediaSummary || '';
		wikiUrl = bird.wikipediaUrl || '';
		ebirdUrl = bird.ebirdUrl || '';
		const id = bird.id;
		if (!detectionsCache[id]) {
			detectionsLoading = true;
			try {
				detectionsCache[id] = await fetchDetections({ speciesId: id, limit: 5, fetch });
			} catch (e) {
				console.error('Failed to fetch detections:', e);
			}
			detectionsLoading = false;
		}
	}

	function closeModal() {
		modalOpen = false;
		modalData = null;
		wikiSummary = '';
		wikiUrl = '';
		ebirdUrl = '';
	}

	function refreshBirdnet() {
		refreshing = true;
		if (typeof window !== 'undefined') {
			localStorage.removeItem('birdnet:species');
			localStorage.removeItem('birdnet:lastUpdated');
		}
		detectionsCache = {};
		birdnetData.update((s) => ({ ...s, lastUpdated: null }));
		loadBirdnetData();
	}

	function scrollToTop() {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	/**
	 * Formats a timestamp into a relative time string (e.g., "5m ago", "Yesterday", "3w ago").
	 * @param {string | Date} timestamp - The date string or Date object to format.
	 * @returns {string} A relative time string.
	 */
	function formatRelativeTime(timestamp: string | Date): string {
		const now = new Date();
		const then = new Date(timestamp);
		const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

		if (diffInSeconds < 2) return `now`;
		if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

		const diffInMinutes = Math.floor(diffInSeconds / 60);
		if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

		const diffInHours = Math.floor(diffInMinutes / 60);
		if (diffInHours < 24) return `${diffInHours}h ago`;

		const diffInDays = Math.floor(diffInHours / 24);
		if (diffInDays === 1) return `Yesterday`;
		if (diffInDays < 7) return `${diffInDays}d ago`;

		const diffInWeeks = Math.floor(diffInDays / 7);
		if (diffInWeeks < 5) return `${diffInWeeks}w ago`;

		const diffInMonths = Math.floor(diffInDays / 30.44);
		if (diffInMonths < 12) return `${diffInMonths}mo ago`;

		const diffInYears = Math.floor(diffInDays / 365.25);
		return `${diffInYears}y ago`;
	}

	$: if (data && data.speciesData) {
		Promise.resolve(data.speciesData).then((resolved) => {
			if (resolved && resolved.species) {
				birdnetData.set({
					species: resolved.species,
					summary: resolved.summary,
					lastUpdated: resolved.lastUpdated,
					loading: false,
					error: null
				});
				refreshing = false;
			}
		});
	}

	$: if (!$birdnetData.loading && refreshing) refreshing = false;
</script>

{#if $birdnetData.loading && !$birdnetData.species.length}
	<div class="text-accent-red flex flex-col items-center justify-center py-16 text-2xl">
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
{:else if $birdnetData.error}
	<p class="text-red-600">Failed to load bird data: {$birdnetData.error}</p>
{:else}
	{#key $birdnetData.species}
		{@html (() => {
			// This ensures speciesStore is updated whenever $birdnetData.species changes
			// which could come from +page.ts load function initially or refreshBirdnet.
			speciesStore.set($birdnetData.species);
			return '';
		})()}
	{/key}

	<div class="m-auto mb-12 w-11/12 text-center">
		<h1 class="mb-4 font-sans text-3xl font-bold">BirdNet</h1>
		<p>These are the birds detected in my backyard using recording devices that run nonstop.</p>
	</div>
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<p class="text-lg">
				Total species: <span class="font-bold"
					>{$birdnetData.summary.total_species.toLocaleString()}</span
				>
			</p>
			<p class="text-lg">
				Total detections: <span class="font-bold"
					>{$birdnetData.summary.total_detections.toLocaleString()}</span
				>
			</p>
		</div>
		<div class="flex flex-col gap-2 sm:flex-row sm:gap-2">
			<input
				type="text"
				placeholder="Search species..."
				class="w-full rounded border px-3 py-2 sm:w-auto dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
				bind:value={$search}
			/>
			<select
				class="w-full rounded border px-3 py-2 sm:w-auto dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
				bind:value={$sortMode}
			>
				<option value="last">Last Heard</option>
				<option value="most">Most Visits</option>
			</select>
		</div>
	</div>

	{#if $filteredSpecies.length}
		<div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each $filteredSpecies as bird (bird.id)}
				<button
					type="button"
					class="group flex w-full flex-col overflow-hidden rounded-lg bg-white shadow-md transition-all duration-200 ease-in-out hover:scale-[1.03] hover:shadow-xl dark:bg-neutral-800 dark:shadow-neutral-100/5 dark:hover:shadow-neutral-100/10"
					on:click={() => openModal(bird)}
					aria-label={`Open details for ${bird.commonName}`}
				>
					<div class="relative aspect-[4/3] w-full">
						<img src={bird.imageUrl} alt={bird.commonName} class="h-full w-full object-cover" />
						<div
							class="absolute right-0.5 bottom-0.5 flex items-center rounded-md bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 20 20"
								fill="currentColor"
								class="mr-1 h-4 w-4"
							>
								<path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
								<path
									fill-rule="evenodd"
									d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.404a1.65 1.65 0 010 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.404zM10 15a5 5 0 100-10 5 5 0 000 10z"
									clip-rule="evenodd"
								/>
							</svg>
							<span>{(bird.detections?.total ?? 0).toLocaleString()}</span>
						</div>
					</div>
					<div class="flex flex-grow flex-col p-3 text-left">
						<h2
							class="group-hover:text-accent-red dark:group-hover:text-accent-red-dark mb-0.5 truncate text-base font-semibold"
						>
							{bird.commonName}
						</h2>
						<p class="mb-1 truncate text-xs text-gray-600 italic dark:text-gray-400">
							{bird.scientificName}
						</p>
						<p class="mt-auto pt-1 text-xs text-gray-500 dark:text-gray-400">
							{formatRelativeTime(bird.latestDetectionAt)}
						</p>
					</div>
				</button>
			{/each}
		</div>
	{:else if $search.trim() !== ''}
		<p class="mt-10 text-center text-lg text-gray-500 dark:text-gray-400">
			No birds found matching "<span class="font-semibold">{$search}</span>".
		</p>
	{:else}
		<p class="mt-10 text-center text-lg text-gray-500 dark:text-gray-400">
			No bird data available.
		</p>
	{/if}

	<!-- Modal -->
	{#if modalOpen && modalData}
		<BirdModal
			bird={modalData}
			detections={detectionsCache[modalData.id] || []}
			loading={detectionsLoading}
			{wikiSummary}
			{wikiUrl}
			{ebirdUrl}
			on:close={closeModal}
		/>
	{/if}

	<!-- Bottom nav bar -->
	<div
		class="fixed bottom-4 left-1/2 z-40 flex w-auto max-w-md -translate-x-1/2 flex-row items-center justify-center gap-4 rounded-xl bg-neutral-900/95 px-4 py-2 text-base text-white shadow-lg backdrop-blur-sm transition-opacity duration-300 md:text-lg"
		class:opacity-0={modalOpen}
		class:pointer-events-none={modalOpen}
		aria-hidden={modalOpen}
	>
		<button
			on:click={scrollToTop}
			aria-label="Back to top"
			class="group hover:bg-accent rounded-lg bg-white p-2 text-xl text-black transition-colors"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5 text-black transition-colors group-hover:text-white"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
			</svg>
		</button>
		<span class="min-w-[10.5rem] truncate text-center text-sm md:text-base">
			{#if refreshing}
				Refreshing Data
			{:else if $birdnetData.lastUpdated}
				Last updated: {new Date($birdnetData.lastUpdated).toLocaleTimeString([], {
					hour: 'numeric',
					minute: '2-digit'
				})}
			{:else}
				—
			{/if}
		</span>
		<button
			on:click={refreshBirdnet}
			aria-label="Refresh bird data"
			class="group hover:bg-accent flex items-center justify-center rounded-lg bg-white p-2 text-xl text-black transition-colors"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				class="h-5 w-5 text-black transition-colors group-hover:text-white"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
				/>
			</svg>
		</button>
	</div>
{/if}
