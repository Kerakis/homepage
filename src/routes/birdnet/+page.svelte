<script lang="ts">
	export let data: { speciesData?: Promise<any> };

	import {
		birdnetData,
		loadAllTimeData,
		load24hData,
		loadLiveData,
		sortMode,
		search
	} from '$lib/stores/birdnet';
	import { fetchDetections } from '$lib/api/fetchDetections';
	import { isDetectionNearHome } from '$lib/stores/birdnetFilters';
	import {
		filteredSpecies,
		filteredSpecies24h,
		filteredLiveDetections
	} from '$lib/stores/birdnetFilters';
	import BirdModal from './BirdModal.svelte';
	import { formatRelativeTime } from '$lib/utils/time';
	import { get } from 'svelte/store';
	import { fly } from 'svelte/transition';
	import { onMount, onDestroy } from 'svelte';
	import { afterNavigate } from '$app/navigation';

	// Add auto-refresh timer
	let autoRefreshInterval: ReturnType<typeof setInterval> | null = null;
	const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

	onMount(() => {
		// Subscribe to sortMode store on client side
		const unsubscribe = sortMode.subscribe((value) => {
			sortModeValue = value;
		});

		const handleFocus = () => {
			// Only refresh if not already loading or refreshing AND it's been more than 5 minutes
			const timeSinceLastUpdate = $birdnetData.lastUpdated
				? now - $birdnetData.lastUpdated
				: Infinity;
			if (!$birdnetData.loading && !refreshing && timeSinceLastUpdate > AUTO_REFRESH_INTERVAL_MS) {
				refreshBirdnet();
			}
		};
		window.addEventListener('focus', handleFocus);

		// Set up auto-refresh for non-live modes
		if (displayMode !== 'live') {
			autoRefreshInterval = setInterval(() => {
				if (!refreshing && !$birdnetData.loading) {
					refreshBirdnet();
				}
			}, AUTO_REFRESH_INTERVAL_MS);
		}

		return () => {
			unsubscribe();
			window.removeEventListener('focus', handleFocus);
			if (autoRefreshInterval) clearInterval(autoRefreshInterval);
		};
	});

	onDestroy(() => {
		if (liveInterval) {
			clearInterval(liveInterval);
		}
		if (tooltipTimeout) {
			clearTimeout(tooltipTimeout);
		}
		if (autoRefreshInterval) {
			// Add this
			clearInterval(autoRefreshInterval);
		}
	});

	afterNavigate(() => {
		const timeSinceLastUpdate = $birdnetData.lastUpdated
			? now - $birdnetData.lastUpdated
			: Infinity;
		if (!$birdnetData.loading && !refreshing && timeSinceLastUpdate > AUTO_REFRESH_INTERVAL_MS) {
			refreshBirdnet();
		}
	});

	let modalOpen = false;
	let modalData: any = null;

	let displayMode: 'all' | '24h' | 'live' =
		((typeof localStorage !== 'undefined' && localStorage.getItem('birdnet:displayMode')) as any) ||
		'all';
	let previousDisplayMode = displayMode;

	// For live mode - use values from store
	let liveInterval: ReturnType<typeof setInterval> | null = null;

	// Modal-related
	let detectionsAllTime: number = 0;

	// Caching for modal recent detections
	let detectionsCache: Record<
		string,
		Array<{ timestamp: string; soundscape: { url: string } }>
	> = {};

	// FIX: Add missing variables from the store
	$: stats24hLoading = $birdnetData.stats24hLoading;
	$: stats24h = $birdnetData.stats24h;
	$: liveLoading = $birdnetData.liveLoading;
	$: liveError = $birdnetData.liveError;
	$: liveLastUpdated = $birdnetData.liveLastUpdated;

	let showTooltip = false;
	let showScrollTooltip = false; // Add this line
	let tooltipTimeout: ReturnType<typeof setTimeout> | null = null;

	function handleTooltip(show: boolean) {
		if (tooltipTimeout) {
			clearTimeout(tooltipTimeout);
			tooltipTimeout = null;
		}

		if (show) {
			showTooltip = true;
		} else {
			tooltipTimeout = setTimeout(() => {
				showTooltip = false;
			}, 200);
		}
	}

	// FIX: Add cooldown calculation
	$: cooldownSecondsLeft =
		typeof window !== 'undefined'
			? Math.ceil((REFRESH_COOLDOWN_MS - (now - ($birdnetData.lastUpdated ?? 0))) / 1000)
			: 0;

	// Load initial data from cache if available
	$: if (
		typeof window !== 'undefined' &&
		data.speciesData &&
		get(birdnetData).lastUpdated === null
	) {
		data.speciesData.then((cachedData) => {
			birdnetData.update((store) => ({
				...store,
				species: cachedData.species,
				summary: cachedData.summary,
				lastUpdated: cachedData.lastUpdated
			}));

			// If we received empty data from server (due to SSR), fetch fresh data on client
			if (
				typeof window !== 'undefined' &&
				cachedData.species.length === 0 &&
				cachedData.lastUpdated === 0
			) {
				console.log('Server returned empty data, fetching fresh data on client');
				refreshBirdnet();
			}
		});
	}

	async function openModal(bird: any) {
		const allTimeSpecies = get(birdnetData).species;
		const canonicalDataFromAllTime = allTimeSpecies.find((s: any) => s.id == bird.id);
		modalData = { ...(canonicalDataFromAllTime || {}), ...bird };
		detectionsAllTime = canonicalDataFromAllTime?.detections?.total ?? bird.detections?.total ?? 0;

		modalOpen = true;
		const id = modalData.id;
		if (!detectionsCache[id]) {
			try {
				const allDetections = await fetchDetections({ speciesId: id, limit: 5, fetch });
				detectionsCache[id] = allDetections.filter(isDetectionNearHome);
			} catch (e) {
				console.error('Failed to fetch recent detections for modal:', e);
				detectionsCache[id] = [];
			}
		}
	}

	function closeModal() {
		modalOpen = false;
		modalData = null;
	}

	// --- Display Mode Logic ---

	// 24h mode
	$: if (displayMode === '24h' && previousDisplayMode !== '24h') {
		refreshing = true;
		refreshStartTime = Date.now();
		load24hData();
		previousDisplayMode = displayMode;
	}

	// Live mode
	$: if (displayMode === 'live' && previousDisplayMode !== 'live') {
		loadLiveData();
		previousDisplayMode = displayMode;
		// Clear any existing interval first
		if (liveInterval) clearInterval(liveInterval);
		// Set up new interval
		liveInterval = setInterval(() => loadLiveData(), 30000);
	} else if (displayMode !== 'live' && liveInterval) {
		clearInterval(liveInterval);
		liveInterval = null;
		if (previousDisplayMode === 'live') {
			previousDisplayMode = displayMode;
		}
	}

	// All time mode (default)
	$: if (
		displayMode === 'all' &&
		(get(birdnetData).lastUpdated === null ||
			get(birdnetData).species.length === 0 ||
			get(birdnetData).error)
	) {
		refreshing = true;
		refreshStartTime = Date.now();
		loadAllTimeData();
	}

	// --- Refresh Logic (PRESERVED EXACTLY) ---
	let refreshStartTime = 0;
	let refreshing = false;

	function refreshBirdnet() {
		if (displayMode === 'all') {
			refreshStartTime = Date.now();
			refreshing = true;
			loadAllTimeData();
		} else if (displayMode === '24h') {
			refreshStartTime = Date.now();
			refreshing = true;
			load24hData();
		} else if (displayMode === 'live') {
			loadLiveData();
		}
	}

	// This ensures refreshing is visible for at least 500ms
	$: if (
		typeof window !== 'undefined' &&
		!$birdnetData.loading &&
		!$birdnetData.stats24hLoading &&
		refreshing
	) {
		const elapsed = Date.now() - refreshStartTime;
		if (elapsed >= 500) {
			refreshing = false;
		} else {
			setTimeout(() => {
				refreshing = false;
			}, 500 - elapsed);
		}
	}

	function scrollToTop() {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	const REFRESH_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown

	let now = Date.now();
	onMount(() => {
		const nowInterval = setInterval(() => {
			now = Date.now();
		}, 1000);
		return () => clearInterval(nowInterval);
	});

	$: isWithinRefreshCooldown =
		typeof window !== 'undefined' &&
		$birdnetData.lastUpdated !== null &&
		now - $birdnetData.lastUpdated < REFRESH_COOLDOWN_MS;
	$: if (typeof window !== 'undefined' && displayMode === 'live' && sortModeValue !== 'last') {
		sortModeValue = 'last';
		sortMode.set('last');
	}
	$: if (typeof localStorage !== 'undefined') {
		localStorage.setItem('birdnet:displayMode', displayMode);
	}

	// Update auto-refresh when display mode changes
	$: {
		const currentMode = displayMode;
		const prevMode = previousDisplayMode;

		if (currentMode === 'live') {
			if (autoRefreshInterval) {
				clearInterval(autoRefreshInterval);
				autoRefreshInterval = null;
			}
		} else {
			// When switching FROM live mode to another mode, refresh data immediately
			if (prevMode === 'live') {
				refreshBirdnet();
			}

			if (!autoRefreshInterval) {
				autoRefreshInterval = setInterval(() => {
					if (!refreshing && !$birdnetData.loading) {
						refreshBirdnet();
					}
				}, AUTO_REFRESH_INTERVAL_MS);
			}
		}
	}

	// Create a derived store with a default value for SSR compatibility
	let sortModeValue: 'last' | 'most' = 'last';

	// Handle sort mode changes
	function handleSortModeChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const newValue = target.value as 'last' | 'most';
		sortModeValue = newValue;
		if (typeof window !== 'undefined') {
			sortMode.set(newValue);
		}
	}
</script>

<svelte:head>
	<title>Kerakis // Birdnet</title>
</svelte:head>

{#if $birdnetData.loading && !$birdnetData.species.length && displayMode === 'all'}
	<div class="flex flex-col items-center justify-center py-16 text-2xl text-black dark:text-white">
		<svg
			class="mb-4 h-12 w-12 animate-spin text-black dark:text-white"
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
	<p class="text-accent">Failed to load bird data: {$birdnetData.error}</p>
{:else}
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
				<p class="text-lg">
					Total species in the last 24h: <span class="font-bold"
						>{#if stats24hLoading}
							<span
								class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-middle"
							></span>
						{:else}
							{stats24h.total_species.toLocaleString()}
						{/if}</span
					>
				</p>
				<p class="text-lg">
					Total detections in the last 24h: <span class="font-bold"
						>{#if stats24hLoading}
							<span
								class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-middle"
							></span>
						{:else}
							{stats24h.total_detections.toLocaleString()}
						{/if}</span
					>
				</p>
			{:else if displayMode === 'live'}
				<p class="text-lg">
					Total detections in last 30 minutes: <span class="font-bold">
						{#if liveLoading}
							<span
								class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-middle"
							></span>
						{:else}
							{$birdnetData.liveDetections.length}
						{/if}
					</span>
				</p>
			{:else}
				<p class="text-lg">
					Total species: <span class="font-bold"
						>{#if $birdnetData.loading && $birdnetData.summary.total_species === 0}
							<span
								class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-middle"
							></span>
						{:else}
							{$birdnetData.summary.total_species.toLocaleString()}
						{/if}</span
					>
				</p>
				<p class="text-lg">
					Total detections: <span class="font-bold"
						>{#if $birdnetData.loading && $birdnetData.summary.total_detections === 0}
							<span
								class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-middle"
							></span>
						{:else}
							{$birdnetData.summary.total_detections.toLocaleString()}
						{/if}</span
					>
				</p>
			{/if}
		</div>
		<div class="flex flex-col gap-2 sm:flex-row sm:gap-2">
			<input
				type="text"
				id="birdnet-search"
				name="birdnet-search"
				placeholder="Search species..."
				class="w-full rounded border px-3 py-2 sm:w-auto dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
				bind:value={$search}
			/>
			<select
				id="birdnet-sort"
				name="birdnet-sort"
				class="w-full rounded border px-3 py-2 sm:w-auto dark:border-neutral-700 dark:bg-neutral-800 dark:text-white
        {displayMode === 'live'
					? 'cursor-not-allowed bg-gray-200 text-gray-500 dark:bg-neutral-700 dark:text-neutral-400'
					: 'cursor-pointer'}"
				bind:value={sortModeValue}
				on:change={handleSortModeChange}
				disabled={displayMode === 'live'}
				style={displayMode === 'live' ? 'pointer-events: none; opacity: 0.7;' : ''}
				on:change={handleSortModeChange}
			>
				<option value="last">Last Heard</option>
				{#if displayMode !== 'live'}
					<option value="most">Most Visits</option>
				{/if}
			</select>
			<select
				id="birdnet-mode"
				name="birdnet-mode"
				class="w-full cursor-pointer rounded border px-3 py-2 sm:w-auto dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
				bind:value={displayMode}
			>
				<option value="all">All Time</option>
				<option value="24h">Last 24h</option>
				<option value="live">Live Mode</option>
			</select>
		</div>
	</div>

	<p class="my-5 text-center text-xs text-gray-500 dark:text-gray-400">
		{#if displayMode === 'live'}
			This page updates automatically every <b>30 seconds</b> in Live Mode.
		{:else}
			This page updates automatically every <b>5 minutes</b>.
		{/if}
	</p>

	{#if displayMode === 'live'}
		{#if liveError}
			<p class="text-center text-lg text-red-600">{liveError}</p>
		{:else if $filteredLiveDetections.length}
			<div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each $filteredLiveDetections as detection (detection.id)}
					<button
						type="button"
						class="group flex w-full cursor-pointer flex-col overflow-hidden rounded-lg bg-white shadow-md transition-all duration-200 ease-in-out hover:scale-[1.03] hover:shadow-xl dark:bg-neutral-800 dark:shadow-neutral-100/5 dark:hover:shadow-neutral-100/10"
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
		{:else if liveLoading}
			<div
				class="flex flex-col items-center justify-center py-16 text-2xl text-black dark:text-white"
			>
				<svg
					class="mb-4 h-12 w-12 animate-spin text-black dark:text-white"
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
			<p class="mt-10 text-center text-lg text-gray-500 dark:text-gray-400">
				No birds detected in the last 30 minutes.
			</p>
		{/if}
	{:else if (displayMode === '24h' ? $filteredSpecies24h : $filteredSpecies).length}
		<div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each displayMode === '24h' ? $filteredSpecies24h : $filteredSpecies as bird (bird.id)}
				<button
					type="button"
					class="group flex w-full cursor-pointer flex-col overflow-hidden rounded-lg bg-white shadow-md transition-all duration-200 ease-in-out hover:scale-[1.03] hover:shadow-xl dark:bg-neutral-800 dark:shadow-neutral-100/5 dark:hover:shadow-neutral-100/10"
					on:click={() => openModal(bird)}
					aria-label={`Open details for ${bird.commonName}`}
					transition:fly={{ y: 20, duration: 300 }}
				>
					<div class="relative aspect-[4/3] w-full">
						<img
							src={bird.imageUrl}
							alt={bird.commonName}
							loading="lazy"
							class="h-full w-full object-cover"
						/>
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
	{:else if (displayMode === 'all' && $birdnetData.loading) || (displayMode === '24h' && stats24hLoading)}
		<div
			class="flex flex-col items-center justify-center py-16 text-2xl text-black dark:text-white"
		>
			<svg
				class="mb-4 h-12 w-12 animate-spin text-black dark:text-white"
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
		<p class="mt-10 text-center text-lg text-gray-500 dark:text-gray-400">
			No bird data available.
		</p>
	{/if}

	<!-- Modal -->
	{#if modalOpen && modalData}
		<BirdModal bird={modalData} {detectionsAllTime} onClose={closeModal} />
	{/if}

	<!-- Bottom nav bar -->
	<div
		class="fixed bottom-1 left-1/2 z-40 flex w-auto max-w-lg -translate-x-1/2 flex-row items-center justify-center gap-2 rounded-lg bg-neutral-900/95 px-1.5 py-1 text-xs text-white shadow-lg backdrop-blur-sm transition-opacity duration-300 md:bottom-4 md:px-4 md:py-2 md:text-lg"
		class:opacity-0={modalOpen}
		class:pointer-events-none={modalOpen}
		aria-hidden={modalOpen}
	>
		<button
			on:click={scrollToTop}
			on:mouseenter={() => (showScrollTooltip = true)}
			on:mouseleave={() => (showScrollTooltip = false)}
			aria-label="Back to top"
			class="group hover:bg-accent cursor-pointer rounded-lg bg-white p-2 text-xl text-black transition-colors"
			style="position: relative;"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-4 w-4 text-black transition-colors group-hover:text-white md:h-5 md:w-5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
			</svg>
			<!-- Back to top tooltip: -->
			{#if showScrollTooltip}
				<div
					class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-32 -translate-x-1/2 rounded bg-neutral-800/90 px-3 py-2 text-xs text-white shadow-lg backdrop-blur-sm"
				>
					Back to top
				</div>
			{/if}
		</button>
		<span class="whitespace-nowrap">
			{#if displayMode === 'live' && liveLastUpdated}
				Last updated: {new Date(liveLastUpdated).toLocaleTimeString([], {
					hour: 'numeric',
					minute: '2-digit'
				})}
			{:else if refreshing}
				Refreshing Data
			{:else if displayMode === '24h' && $birdnetData.lastUpdated}
				Last updated: {new Date($birdnetData.lastUpdated).toLocaleTimeString([], {
					hour: 'numeric',
					minute: '2-digit'
				})}
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
			on:click={() => {
				if (displayMode === 'live' || refreshing || isWithinRefreshCooldown) {
					handleTooltip(true);
				} else {
					refreshBirdnet();
				}
			}}
			on:mouseenter={() => {
				handleTooltip(true);
			}}
			on:mouseleave={() => handleTooltip(false)}
			on:touchstart={() => {
				handleTooltip(true);
			}}
			aria-label="Refresh bird data"
			class="group hover:bg-accent flex items-center justify-center rounded-lg bg-white p-2
        text-xl text-black transition-colors
        {displayMode === 'live' || refreshing || isWithinRefreshCooldown
				? 'cursor-not-allowed'
				: 'cursor-pointer'}"
			disabled={displayMode === 'live' || refreshing || isWithinRefreshCooldown}
			style="position: relative;"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				class="h-4 w-4 transition-colors group-hover:text-white md:h-5 md:w-5
            {displayMode === 'live' || refreshing ? 'animate-spin' : 'text-black'}"
				style={displayMode === 'live' || refreshing ? 'animation-duration: 2.5s;' : ''}
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
				/>
			</svg>
			<!-- Refresh button tooltip: -->
			{#if showTooltip}
				<div
					class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded bg-neutral-800/90 px-3 py-2 text-xs text-white shadow-lg backdrop-blur-sm"
				>
					{#if displayMode === 'live'}
						Live Mode refreshes automatically every 30 seconds.
					{:else if refreshing}
						Refreshing now...
					{:else if isWithinRefreshCooldown}
						Manual refresh is on cooldown ({cooldownSecondsLeft}s left).<br />
						This helps prevent excessive API calls.<br />
						Page updates automatically every 5 minutes.
					{:else}
						Manually refresh the data
					{/if}
				</div>
			{/if}
		</button>
	</div>
{/if}
