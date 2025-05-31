<script lang="ts">
	export let data: { speciesData?: Promise<any> };

	import { birdnetData, loadBirdnetData } from '$lib/stores/birdnet';
	import { fetchDetections } from '$lib/fetchDetections';
	import { fetchStationStats } from '$lib/fetchStationStats';
	import { fetchAllSpecies } from '$lib/fetchSpecies';
	import BirdModal from './BirdModal.svelte';
	import { formatRelativeTime } from '$lib/utils/time';
	import { fetchAllLiveDetections } from '$lib/fetchLiveDetections';
	import { filteredSpecies } from '$lib/stores/birdnetFilters';
	import { speciesStore, sortMode, search } from '$lib/stores/birdnet';
	import { get } from 'svelte/store';
	import { fly } from 'svelte/transition';
	import { liveDetectionsStore, filteredLiveDetections } from '$lib/stores/birdnetLiveFilters';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';

	onMount(() => {
		const handleFocus = () => {
			// Only refresh if not already loading or refreshing
			if (!$birdnetData.loading && !refreshing) {
				refreshBirdnet();
			}
		};
		window.addEventListener('focus', handleFocus);
		return () => window.removeEventListener('focus', handleFocus);
	});

	afterNavigate(() => {
		if (!$birdnetData.loading && !refreshing) {
			refreshBirdnet();
		}
	});

	let modalOpen = false;
	let modalData: any = null;
	let liveLastUpdated: number | null = null;

	let displayMode: 'all' | '24h' | 'live' =
		((typeof localStorage !== 'undefined' && localStorage.getItem('birdnet:displayMode')) as any) ||
		'all';

	// For 24h mode
	let stats24h = { total_species: 0, total_detections: 0 };
	let stats24hLoading = false;

	// For live mode
	let liveInterval: ReturnType<typeof setInterval> | null = null;
	let liveError = '';
	let liveLoading = false;

	// Modal-related
	let detectionsAllTime: number = 0;

	// Caching for modal recent detections
	let detectionsCache: Record<
		string,
		Array<{ timestamp: string; soundscape: { url: string } }>
	> = {};

	// --- Display Mode Logic and all other logic remain unchanged ---

	// 1. Always fetch and cache All Time species data at app start
	$: if (
		displayMode === 'all' &&
		data &&
		data.speciesData &&
		(get(birdnetData).lastUpdated === null ||
			get(birdnetData).species.length === 0 ||
			get(birdnetData).error)
	) {
		Promise.resolve(data.speciesData)
			.then((resolved) => {
				if (resolved && resolved.species) {
					const current = get(birdnetData);
					// Only update if the cache is newer or the store is empty
					if (
						!current.lastUpdated ||
						(resolved.lastUpdated && resolved.lastUpdated > current.lastUpdated)
					) {
						birdnetData.set({
							species: resolved.species,
							summary: resolved.summary,
							lastUpdated: resolved.lastUpdated,
							loading: false,
							error: null
						});
						speciesStore.set(resolved.species);
					}
				} else {
					birdnetData.set({
						species: [],
						summary: { total_species: 0, total_detections: 0 },
						lastUpdated: null,
						loading: false,
						error: 'No data received'
					});
				}
			})
			.catch((e) => {
				birdnetData.set({
					species: [],
					summary: { total_species: 0, total_detections: 0 },
					lastUpdated: null,
					loading: false,
					error: 'Failed to load data'
				});
			});
	}

	async function openModal(bird: any) {
		const allTimeSpecies = get(birdnetData).species;
		const canonicalDataFromAllTime = allTimeSpecies.find((s: any) => s.id == bird.id);

		modalData = { ...(canonicalDataFromAllTime || {}), ...bird };

		modalOpen = true;

		detectionsAllTime = canonicalDataFromAllTime?.detections?.total ?? bird.detections?.total ?? 0;

		const id = modalData.id;
		if (!detectionsCache[id]) {
			try {
				detectionsCache[id] = await fetchDetections({ speciesId: id, limit: 5, fetch });
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
			liveLoading = true;
			liveError = '';
			try {
				const data = await fetchAllLiveDetections({ fetch });
				liveDetectionsStore.set(data || []);
				liveLastUpdated = Date.now();
			} catch (e) {
				liveError = 'Failed to fetch live detections';
				console.error(e);
			} finally {
				liveLoading = false;
			}
		};
		fetchLive();
		if (liveInterval) clearInterval(liveInterval);
		liveInterval = setInterval(fetchLive, 30000);
	} else {
		if (liveInterval) {
			clearInterval(liveInterval);
			liveInterval = null;
		}
	}

	// All time mode (default)
	$: if (
		displayMode === 'all' &&
		data &&
		data.speciesData &&
		get(birdnetData).lastUpdated === null // Only set if not already loaded/refreshed
	) {
		Promise.resolve(data.speciesData)
			.then((resolved) => {
				if (resolved && resolved.species) {
					birdnetData.set({
						species: resolved.species,
						summary: resolved.summary,
						lastUpdated: resolved.lastUpdated,
						loading: false,
						error: null
					});
					speciesStore.set(resolved.species);
				} else {
					birdnetData.set({
						species: [],
						summary: { total_species: 0, total_detections: 0 },
						lastUpdated: null,
						loading: false,
						error: 'No data received'
					});
				}
			})
			.catch((e) => {
				birdnetData.set({
					species: [],
					summary: { total_species: 0, total_detections: 0 },
					lastUpdated: null,
					loading: false,
					error: 'Failed to load data'
				});
			});
	}

	let autoRefreshIntervalId: ReturnType<typeof setInterval> | null = null;

	function initiateAutoRefresh(interval: number) {
		if (autoRefreshIntervalId) clearInterval(autoRefreshIntervalId);
		autoRefreshIntervalId = setInterval(() => {
			if (displayMode === 'live') {
				// Only refresh live data in live mode
				if (!refreshing) refreshBirdnet();
			} else if (!refreshing) {
				refreshBirdnet();
			}
		}, interval);
	}

	function stopAutoRefresh() {
		if (autoRefreshIntervalId) {
			clearInterval(autoRefreshIntervalId);
			autoRefreshIntervalId = null;
		}
	}

	// Manage auto-refresh based on mode
	$: {
		if (typeof window !== 'undefined') {
			if (displayMode === 'live') {
				initiateAutoRefresh(30_000); // 30 seconds
			} else if (displayMode === 'all' || displayMode === '24h') {
				initiateAutoRefresh(5 * 60_000); // 5 minutes
			} else {
				stopAutoRefresh();
			}
		}
	}

	// --- Refresh Logic ---

	let refreshStartTime = 0;
	let refreshing = false;

	function refreshBirdnet() {
		if (isWithinRefreshCooldown) return;
		refreshing = true;
		loadBirdnetData();
	}

	$: if (!$birdnetData.loading && refreshing) {
		refreshing = false;
	}

	// Ensure refreshing is visible for at least 500ms
	$: if (!$birdnetData.loading && refreshing) {
		const elapsed = Date.now() - refreshStartTime;
		if (elapsed < 500) {
			setTimeout(() => {
				refreshing = false;
			}, 500 - elapsed);
		} else {
			refreshing = false;
		}
	}

	function scrollToTop() {
		if (typeof window !== 'undefined') {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}

	const REFRESH_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown

	let now = Date.now();
	let nowInterval: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		nowInterval = setInterval(() => {
			now = Date.now();
		}, 250);
		return () => {
			if (nowInterval) clearInterval(nowInterval);
		};
	});

	$: isWithinRefreshCooldown =
		typeof $birdnetData.lastUpdated === 'number' && $birdnetData.lastUpdated > 0
			? now - $birdnetData.lastUpdated < REFRESH_COOLDOWN_MS
			: false;

	$: if (!$birdnetData.loading && refreshing) refreshing = false;
	$: if (displayMode === 'live' && $sortMode !== 'last') sortMode.set('last');
	$: if (typeof localStorage !== 'undefined') {
		localStorage.setItem('birdnet:displayMode', displayMode);
		localStorage.setItem('birdnet:sortMode', $sortMode);
	}

	$: if (displayMode === 'all') {
		speciesStore.set($birdnetData.species);
	}

	const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

	$: isStale =
		$birdnetData.lastUpdated !== null && Date.now() - $birdnetData.lastUpdated > STALE_THRESHOLD_MS;

	let showTooltip = false;
	let tooltipTimeout: ReturnType<typeof setTimeout> | null = null;
	let cooldownInterval: ReturnType<typeof setInterval> | null = null;
	let cooldownCheckInterval: ReturnType<typeof setInterval> | null = null;
	let cooldownSecondsLeft = 0;

	function updateCooldownSecondsLeft() {
		if (typeof $birdnetData.lastUpdated === 'number' && $birdnetData.lastUpdated > 0) {
			const left = Math.ceil(
				(REFRESH_COOLDOWN_MS - (Date.now() - $birdnetData.lastUpdated)) / 1000
			);
			cooldownSecondsLeft = left > 0 ? left : 0;
		} else {
			cooldownSecondsLeft = 0;
		}
		// Hide tooltip if cooldown is over
		if (cooldownSecondsLeft === 0 && showTooltip) {
			showTooltip = false;
		}
	}

	function handleTooltip(show: boolean) {
		showTooltip = show;
		if (show) {
			updateCooldownSecondsLeft();
			if (cooldownInterval) clearInterval(cooldownInterval);
			cooldownInterval = setInterval(() => {
				updateCooldownSecondsLeft();
			}, 250);
			if (tooltipTimeout) {
				clearTimeout(tooltipTimeout);
				tooltipTimeout = null;
			}
			// Auto-hide tooltip after 2.5s on mobile tap
			if ('ontouchstart' in window) {
				tooltipTimeout = setTimeout(() => {
					showTooltip = false;
				}, 2500);
			}
		} else {
			if (cooldownInterval) {
				clearInterval(cooldownInterval);
				cooldownInterval = null;
			}
			if (tooltipTimeout) {
				clearTimeout(tooltipTimeout);
				tooltipTimeout = null;
			}
		}
	}

	function getCooldownSecondsLeft() {
		if (typeof $birdnetData.lastUpdated === 'number' && $birdnetData.lastUpdated > 0) {
			const left = Math.ceil(
				(REFRESH_COOLDOWN_MS - (Date.now() - $birdnetData.lastUpdated)) / 1000
			);
			return left > 0 ? left : 0;
		}
		return 0;
	}

	onMount(() => {
		cooldownCheckInterval = setInterval(() => {
			// This will trigger Svelte reactivity for isWithinRefreshCooldown
			// because it depends on $birdnetData.lastUpdated and Date.now()
		}, 250);
		return () => {
			if (cooldownCheckInterval) clearInterval(cooldownCheckInterval);
		};
	});
</script>

{#if $birdnetData.loading && !$birdnetData.species.length && displayMode === 'all'}
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

	<div class="m-auto mb-12 w-11/12 text-center">
		<h1 class="mb-4 font-sans text-3xl font-bold">BirdNet</h1>
		<p>These are the birds detected in my backyard using recording devices that run constantly.</p>
	</div>
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
							{$liveDetectionsStore.length}
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
							<h2 class="mb-0.5 truncate text-base font-semibold">
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
		<BirdModal bird={modalData} {detectionsAllTime} on:close={closeModal} />
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
			aria-label="Back to top"
			class="group hover:bg-accent cursor-pointer rounded-lg bg-white p-2 text-xl text-black transition-colors"
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
		</button>
		<span class="whitespace-nowrap">
			{#if displayMode === 'live' && liveLastUpdated}
				Last updated: {new Date(liveLastUpdated).toLocaleTimeString([], {
					hour: 'numeric',
					minute: '2-digit'
				})}
			{:else if refreshing || isStale}
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
			on:click={() => {
				if (displayMode === 'live' || refreshing || isWithinRefreshCooldown) {
					handleTooltip(true);
				} else {
					refreshBirdnet();
				}
			}}
			on:mouseenter={() => {
				if (displayMode === 'live' || refreshing || isWithinRefreshCooldown) handleTooltip(true);
			}}
			on:mouseleave={() => handleTooltip(false)}
			on:touchstart={() => {
				if (displayMode === 'live' || refreshing || isWithinRefreshCooldown) handleTooltip(true);
			}}
			aria-label="Refresh bird data"
			class="group hover:bg-accent flex items-center justify-center rounded-lg bg-white p-2
        text-xl text-black transition-colors
        {displayMode === 'live' || refreshing || isWithinRefreshCooldown
				? 'cursor-not-allowed opacity-60'
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
			{#if showTooltip}
				<div
					class="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded bg-neutral-800 px-3 py-2 text-xs text-white shadow-lg"
					style="pointer-events: none;"
				>
					{#if displayMode === 'live'}
						Live Mode refreshes automatically every 30 seconds.
					{:else if refreshing}
						Refreshing now...
					{:else if isWithinRefreshCooldown}
						Manual refresh is on cooldown ({cooldownSecondsLeft}s left).<br />
						This helps prevent excessive API calls.<br />
						Page updates automatically every 5 minutes.
					{/if}
				</div>
			{/if}
		</button>
	</div>
{/if}
