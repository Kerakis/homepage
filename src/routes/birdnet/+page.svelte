<script lang="ts">
	export let data: { speciesData?: Promise<any> };

	import { birdnetData, loadBirdnetData } from '$lib/stores/birdnet';
	import { fetchDetections } from '$lib/fetchDetections';
	import { fetchStationStats } from '$lib/fetchStationStats';
	import { fetchAllSpecies } from '$lib/fetchSpecies';
	import { writable, derived, type Writable } from 'svelte/store';
	import { fly } from 'svelte/transition';
	import BirdModal from './BirdModal.svelte';
	import { onDestroy } from 'svelte';
	import { get } from 'svelte/store';

	let modalOpen = false;
	let modalData: any = null;
	let wikiSummary = '';
	let wikiUrl = '';
	let ebirdUrl = '';
	let liveLastUpdated: number | null = null;

	const speciesStore: Writable<any[]> = writable([]);
	const initialSortMode =
		((typeof localStorage !== 'undefined' && localStorage.getItem('birdnet:sortMode')) as any) ||
		'last';
	const sortMode = writable<'last' | 'most'>(initialSortMode);
	const search = writable('');
	let displayMode: 'all' | '24h' | 'live' =
		((typeof localStorage !== 'undefined' && localStorage.getItem('birdnet:displayMode')) as any) ||
		'all';

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

	// For 24h mode
	let stats24h = { total_species: 0, total_detections: 0 };
	let stats24hLoading = false;

	// For live mode
	let liveDetections: any[] = [];
	let liveInterval: ReturnType<typeof setInterval> | null = null;
	let liveError = '';

	let detections24h: number | null = null;
	let detectionsAllTime: number = 0;
	let detections24hLoading = false;

	async function openModal(bird: any) {
		const allTimeSpecies = get(birdnetData).species?.find((s: any) => s.id == bird.id);
		const fullSpecies = allTimeSpecies || bird;
		modalData = fullSpecies;
		modalOpen = true;
		wikiSummary = fullSpecies.wikipediaSummary || '';
		wikiUrl = fullSpecies.wikipediaUrl || '';
		ebirdUrl = fullSpecies.ebirdUrl || '';

		// Always set all-time detections
		detectionsAllTime = allTimeSpecies?.detections?.total ?? fullSpecies.detections?.total ?? 0;

		// Always fetch 24h detections for this species
		detections24hLoading = true;
		try {
			const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
			const species24h = await fetchAllSpecies({ fetch, since });
			const match = species24h?.find((s: any) => s.id == bird.id);
			detections24h = match?.detections?.total ?? 0;
		} catch {
			detections24h = 0;
		}
		detections24hLoading = false;

		const id = fullSpecies.id;
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

	async function fetchAllLiveDetections({ fetch }: { fetch: typeof window.fetch }) {
		let allDetections: any[] = [];
		let cursor: number | undefined = undefined;
		const now = new Date();
		const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

		const from = thirtyMinutesAgo.toISOString();
		const to = now.toISOString();

		let page = 1;
		let lastDetectionId: number | undefined = undefined;
		while (true) {
			let url = `https://app.birdweather.com/api/v1/stations/5026/detections?limit=100&order=desc&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
			if (cursor !== undefined) url += `&cursor=${cursor}`;
			const response = await fetch(url);
			const data = await response.json();
			const detections = data.detections || [];
			if (detections.length === 0) break;

			// Remove duplicate if present
			if (lastDetectionId !== undefined && detections[0]?.id === lastDetectionId) {
				detections.shift();
			}

			allDetections = [...allDetections, ...detections];

			if (detections.length < 100) break;

			const oldest = detections[detections.length - 1];
			lastDetectionId = oldest?.id;
			cursor = oldest?.id;
			page++;
		}
		return allDetections;
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

	// --- Display Mode Logic ---

	// 24h mode
	$: if (displayMode === '24h') {
		stats24hLoading = true;
		const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
		Promise.all([fetchAllSpecies({ fetch, since }), fetchStationStats({ fetch, since })])
			.then(([species, stats]) => {
				speciesStore.set(species);
				stats24h = {
					total_species: stats.species ?? 0,
					total_detections: stats.detections ?? 0
				};
			})
			.catch(() => {
				stats24h = { total_species: 0, total_detections: 0 };
			})
			.finally(() => {
				stats24hLoading = false;
			});
	}

	// Live mode
	$: if (displayMode === 'live') {
		const fetchLive = async () => {
			liveError = '';
			try {
				const data = await fetchAllLiveDetections({ fetch });
				liveDetections = data || [];
				liveLastUpdated = Date.now();
			} catch (e) {
				liveError = 'Failed to fetch live detections';
			}
		};
		fetchLive();
		if (liveInterval) clearInterval(liveInterval);
		liveInterval = setInterval(fetchLive, 30000);
	} else {
		if (liveInterval) clearInterval(liveInterval);
	}

	// All time mode (default)
	$: if (displayMode === 'all' && data && data.speciesData) {
		Promise.resolve(data.speciesData).then((resolved) => {
			if (resolved && resolved.species) {
				birdnetData.set({
					species: resolved.species,
					summary: resolved.summary,
					lastUpdated: resolved.lastUpdated,
					loading: false,
					error: null
				});
				speciesStore.set(resolved.species);
				refreshing = false;
			}
		});
	}

	$: filteredLiveDetections = liveDetections.filter(
		(d) =>
			d.species?.commonName?.toLowerCase().includes($search.toLowerCase()) ||
			d.species?.scientificName?.toLowerCase().includes($search.toLowerCase())
	);

	$: if (!$birdnetData.loading && refreshing) refreshing = false;
	$: if (displayMode === 'live' && $sortMode !== 'last') sortMode.set('last');
	$: if (typeof localStorage !== 'undefined') {
		localStorage.setItem('birdnet:displayMode', displayMode);
		localStorage.setItem('birdnet:sortMode', $sortMode);
	}
</script>

<svelte:head>
	<title>Kerakis // Birdnet</title>
</svelte:head>

{#if $birdnetData.loading && !$birdnetData.species.length && displayMode === 'all'}
	<div class="text-accent flex flex-col items-center justify-center py-16 text-2xl">
		<svg
			class="text-accent mb-4 h-12 w-12 animate-spin"
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

	<header class="mb-6 text-sm text-black dark:text-white" aria-label="Breadcrumb">
		<span class="font-bold">BirdNet</span>
		<span class="text-accent mx-2">—</span>
		<span>
			These are the birds detected in my backyard using recording devices that run constantly.
		</span>
	</header>
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
		<div>
			{#if displayMode === '24h'}
				{#if stats24hLoading}
					<p class="text-lg text-gray-400">Loading 24h stats...</p>
				{:else}
					<p class="text-lg">
						Total species in the last 24h: <span class="font-bold"
							>{stats24h.total_species.toLocaleString()}</span
						>
					</p>
					<p class="text-lg">
						Total detections in the last 24h: <span class="font-bold"
							>{stats24h.total_detections.toLocaleString()}</span
						>
					</p>
				{/if}
			{:else if displayMode === 'live'}
				<p class="text-lg">
					Total detections in last 30 minutes: <span class="font-bold">{liveDetections.length}</span
					>
				</p>
			{:else}
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
			{/if}
		</div>
		<div class="flex flex-col gap-2 sm:flex-row sm:gap-2">
			<input
				type="text"
				placeholder="Search species..."
				class="w-full rounded border px-3 py-2 sm:w-auto dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
				bind:value={$search}
			/>
			<select
				class="w-full rounded border px-3 py-2 sm:w-auto dark:border-neutral-700 dark:bg-neutral-800 dark:text-white
        {displayMode === 'live'
					? 'cursor-not-allowed bg-gray-200 text-gray-500 dark:bg-neutral-700 dark:text-neutral-400'
					: ''}"
				bind:value={$sortMode}
				disabled={displayMode === 'live'}
				style={displayMode === 'live' ? 'pointer-events: none; opacity: 0.7;' : ''}
			>
				<option value="last">Last Heard</option>
				{#if displayMode !== 'live'}
					<option value="most">Most Visits</option>
				{/if}
			</select>
			<select
				class="w-full rounded border px-3 py-2 sm:w-auto dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
				bind:value={displayMode}
			>
				<option value="all">All Time</option>
				<option value="24h">Last 24h</option>
				<option value="live">Live Mode</option>
			</select>
		</div>
	</div>

	{#if displayMode === 'live'}
		{#if liveError}
			<p class="text-center text-lg text-red-600">{liveError}</p>
		{:else if filteredLiveDetections.length}
			<div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each filteredLiveDetections as detection (detection.id)}
					<button
						type="button"
						class="group flex w-full flex-col overflow-hidden rounded-lg bg-white shadow-md transition-all duration-200 ease-in-out hover:scale-[1.03] hover:shadow-xl dark:bg-neutral-800 dark:shadow-neutral-100/5 dark:hover:shadow-neutral-100/10"
						on:click={() => openModal(detection.species)}
						aria-label={`Open details for ${detection.species?.commonName}`}
						transition:fly={{ y: 20, duration: 300 }}
					>
						<div class="relative aspect-[4/3] w-full">
							<img
								src={detection.species?.imageUrl}
								alt={detection.species?.commonName}
								class="h-full w-full object-cover"
							/>
							<div
								class="absolute right-0.5 bottom-0.5 flex items-center rounded-md bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm"
							>
								<span>Confidence: {Math.round((detection.confidence ?? 0) * 100)}%</span>
							</div>
						</div>
						<div class="flex flex-grow flex-col p-3 text-left">
							<h2 class="group-hover:text-accent mb-0.5 truncate text-base font-semibold">
								{detection.species?.commonName}
							</h2>
							<p class="mb-1 truncate text-xs text-gray-600 italic dark:text-gray-400">
								{detection.species?.scientificName}
							</p>
							<p class="mt-auto pt-1 text-xs text-gray-500 dark:text-gray-400">
								{formatRelativeTime(detection.timestamp)}
							</p>
						</div>
					</button>
				{/each}
			</div>
		{:else if $search.trim() !== ''}
			<p class="mt-10 text-center text-lg text-gray-500 dark:text-gray-400">
				No birds found matching "<span class="font-semibold">{$search}</span>" in the last 30
				minutes.
			</p>
		{:else}
			<p class="mt-10 text-center text-lg text-gray-500 dark:text-gray-400">
				No birds detected in the last 30 minutes.
			</p>
		{/if}
	{:else if $filteredSpecies.length}
		<div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each $filteredSpecies as bird (bird.id)}
				<button
					type="button"
					class="group flex w-full flex-col overflow-hidden rounded-lg bg-white shadow-md transition-all duration-200 ease-in-out hover:scale-[1.03] hover:shadow-xl dark:bg-neutral-800 dark:shadow-neutral-100/5 dark:hover:shadow-neutral-100/10"
					on:click={() => openModal(bird)}
					aria-label={`Open details for ${bird.commonName}`}
					transition:fly={{ y: 20, duration: 300 }}
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
							class="dark:group-hover:text-accent-dark group-hover:text-accent mb-0.5 truncate text-base font-semibold"
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
			{detections24h}
			{detectionsAllTime}
			{detections24hLoading}
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
			{#if displayMode === 'live' && liveLastUpdated}
				Last updated: {new Date(liveLastUpdated).toLocaleTimeString([], {
					hour: 'numeric',
					minute: '2-digit'
				})}
			{:else if refreshing}
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
			class="group hover:bg-accent flex items-center justify-center rounded-lg bg-white p-2 text-xl
        text-black transition-colors
        {displayMode === 'live' ? 'cursor-not-allowed' : ''}"
			disabled={displayMode === 'live'}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				class="h-5 w-5 transition-colors group-hover:text-white
            {displayMode === 'live' || refreshing ? 'animate-spin' : 'text-black'}"
				style={displayMode === 'live' || refreshing ? 'animation-duration: 2.5s;' : ''}
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
