<script lang="ts">
	import { birdnetData, loadBirdnetData } from '$lib/stores/birdnet';
	import { fetchDetections } from '$lib/fetchDetections';
	import { onMount } from 'svelte';
	import { writable, derived, type Writable } from 'svelte/store';
	import BirdModal from './BirdModal.svelte';

	let modalOpen = false;
	let modalData: any = null;
	let wikiSummary = '';
	let wikiUrl = '';
	let ebirdUrl = '';
	const isLoading = writable(false);

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
			} catch {}
			detectionsLoading = false;
		}
	}

	function closeModalHandler() {
		// Renamed to avoid confusion if there's a global 'closeModal'
		console.log('[+page.svelte] closeModalHandler function called by on:close.');
		modalOpen = false;
		modalData = null;
		wikiSummary = '';
		wikiUrl = '';
		ebirdUrl = '';
		// Log the state of modalOpen after changing it
		console.log('[+page.svelte] modalOpen is now:', modalOpen);
	}

	function refreshBirdnet() {
		if (typeof window !== 'undefined') localStorage.removeItem('birdnet:species');
		detectionsCache = {}; // clear detection cache on refresh
		loadBirdnetData();
	}

	function scrollToTop() {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	onMount(() => {
		// Try to load from localStorage first
		if (typeof window !== 'undefined') {
			const raw = localStorage.getItem('birdnet:species');
			if (raw) {
				const cached = JSON.parse(raw);
				// Ensure birdnetData store is updated correctly, including loading state
				birdnetData.set({
					species: cached.species,
					summary: cached.summary,
					lastUpdated: cached.lastUpdated,
					loading: false,
					error: null
				});
			} else {
				loadBirdnetData();
			}
		} else {
			loadBirdnetData();
		}
	});
</script>

{#if $birdnetData.loading}
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
			speciesStore.set($birdnetData.species);
			return '';
		})()}
	{/key}

	<h1 class="mb-2 text-3xl font-bold">These are the birds in my yard</h1>
	<div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<p class="text-lg">
				Total species: <span class="font-bold">{$birdnetData.summary.total_species}</span>
			</p>
			<p class="text-lg">
				Total detections: <span class="font-bold">{$birdnetData.summary.total_detections}</span>
			</p>
		</div>
		<div class="flex gap-2">
			<input
				type="text"
				placeholder="Search species..."
				class="rounded border px-2 py-1 dark:bg-black dark:text-white"
				bind:value={$search}
			/>
			<select class="rounded border px-2 py-1 dark:bg-black dark:text-white" bind:value={$sortMode}>
				<option value="last">Last Heard</option>
				<option value="most">Most Visits</option>
			</select>
		</div>
	</div>

	{#if $filteredSpecies.length}
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each $filteredSpecies as bird (bird.id)}
				<button
					type="button"
					class="flex w-full flex-col items-center rounded-lg bg-white p-4 shadow transition hover:shadow-lg dark:bg-black"
					on:click={() => openModal(bird)}
					aria-label={`Open details for ${bird.commonName}`}
				>
					<img
						src={bird.imageUrl}
						alt={bird.commonName}
						class="mb-2 h-32 w-32 rounded-full object-cover"
					/>
					<h2 class="mb-1 text-lg font-semibold">{bird.commonName}</h2>
					<p class="mb-1 text-sm text-gray-500 italic dark:text-gray-400">
						{bird.scientificName}
					</p>
					<p class="mb-1 text-xs text-gray-400">
						Last detected: {new Date(bird.latestDetectionAt).toLocaleString()}
					</p>
					<p class="bg-accent-red/10 text-accent-red mt-2 rounded px-2 py-1 font-bold">
						{bird.detections?.total ?? 0} detections
					</p>
				</button>
			{/each}
		</div>
	{:else}
		<p>No birds detected yet!</p>
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
			on:close={() => {
				console.log('[+page.svelte] Inline on:close triggered!');
				closeModalHandler();
			}}
		/>
	{/if}

	<!-- Sticky, centered, compact bottom nav bar (Tailwind) -->
	<div
		class="fixed bottom-4 left-1/2 z-50 flex w-auto max-w-md -translate-x-1/2 flex-row items-center justify-center gap-4 rounded-xl bg-neutral-900/95 px-4 py-2 text-base text-white shadow-lg md:text-lg"
	>
		<button
			on:click={scrollToTop}
			aria-label="Back to top"
			class="hover:bg-accent-red rounded bg-white p-2 text-xl text-black transition hover:text-white"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
			</svg>
		</button>
		<span class="truncate text-sm md:text-base">
			Last updated:
			{#if $birdnetData.lastUpdated}
				{new Date($birdnetData.lastUpdated).toLocaleTimeString()}
			{:else}
				—
			{/if}
		</span>
		<button
			on:click={refreshBirdnet}
			aria-label="Refresh bird data"
			class="hover:bg-accent-red flex items-center justify-center rounded bg-white p-2 text-xl text-black transition hover:text-white"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 4v5h.582M20 20v-5h-.581M5.42 19.418A9 9 0 0021 12.998M18.364 5.636A9 9 0 003 11.998"
				/>
			</svg>
		</button>
	</div>
{/if}
