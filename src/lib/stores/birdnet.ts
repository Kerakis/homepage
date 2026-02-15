import { writable } from 'svelte/store';
import { fetchAllSpecies } from '$lib/api/fetchSpecies';
import { fetchSpeciesDetails } from '$lib/api/fetchSpeciesDetails';
import { fetchAllLiveDetections } from '$lib/api/fetchLiveDetections';
import { fetchStationStats } from '$lib/api/fetchStationStats';

export type Species = {
	id: string;
	commonName: string;
	scientificName: string;
	color?: string;
	imageUrl?: string;
	thumbnailUrl?: string;
	wikipediaUrl?: string;
	wikipediaSummary?: string;
	ebirdUrl?: string;
	detections?: {
		total: number;
		almostCertain?: number;
		veryLikely?: number;
		uncertain?: number;
		unlikely?: number;
	};
	latestDetectionAt: string;
};

export type LiveDetection = {
	id: number;
	species: Species;
	timestamp: string;
	confidence?: number;
	lat?: number;
	lon?: number;
	soundscape?: {
		url: string;
		startTime?: number;
	};
};

// Single consolidated store for ALL birdnet data
export const birdnetData = writable({
	// All-time data
	species: [] as Species[],
	summary: { total_species: 0, total_detections: 0 },
	lastUpdated: null as number | null,
	loading: false,
	error: null as string | null,

	// 24h data
	species24h: [] as Species[],
	stats24h: { total_species: 0, total_detections: 0 },
	stats24hLoading: false,

	// Live data
	liveDetections: [] as LiveDetection[],
	liveLastUpdated: null as number | null,
	liveLoading: false,
	liveError: ''
});

// UI state stores
export const sortMode = writable<'last' | 'most'>('last');
export const search = writable('');

// Actions for loading different data types
export async function loadAllTimeData() {
	// Only proceed if we're in the browser
	if (typeof window === 'undefined') {
		console.warn('loadAllTimeData called on server side, skipping');
		return;
	}

	birdnetData.update((store) => ({ ...store, loading: true, error: null }));

	try {
		const speciesFromApi = await fetchAllSpecies({ fetch: window.fetch, period: 'all' });
		const summary = {
			total_species: speciesFromApi.length,
			total_detections: speciesFromApi.reduce((sum, s) => sum + (s.detections?.total ?? 0), 0)
		};

		const identifiers = speciesFromApi.map((s) => `${s.scientificName}_${s.commonName}`);
		const detailsMap = await fetchSpeciesDetails(identifiers, window.fetch);

		const speciesWithDetails: Species[] = speciesFromApi.map((s) => {
			const key = `${s.scientificName}_${s.commonName}`;
			const details = detailsMap[key] || {};
			return { ...s, ...details, id: String(s.id) };
		});

		birdnetData.update((store) => ({
			...store,
			species: speciesWithDetails,
			summary,
			lastUpdated: Date.now(),
			loading: false,
			error: null
		}));
	} catch (error) {
		console.error('Error loading all-time data:', error);
		birdnetData.update((store) => ({
			...store,
			loading: false,
			error: error instanceof Error ? error.message : 'Failed to load data'
		}));
	}
}

export async function load24hData() {
	// Only proceed if we're in the browser
	if (typeof window === 'undefined') {
		console.warn('load24hData called on server side, skipping');
		return;
	}

	birdnetData.update((store) => ({ ...store, stats24hLoading: true }));

	try {
		const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
		const [species, stats] = await Promise.all([
			fetchAllSpecies({ fetch: window.fetch, since }),
			fetchStationStats({ fetch: window.fetch, since })
		]);

		birdnetData.update((store) => ({
			...store,
			species24h: species,
			stats24h: {
				total_species: stats.species ?? 0,
				total_detections: stats.detections ?? 0
			},
			stats24hLoading: false
		}));
	} catch (error) {
		console.error('Error loading 24h data:', error);
		birdnetData.update((store) => ({
			...store,
			stats24h: { total_species: 0, total_detections: 0 },
			stats24hLoading: false
		}));
	}
}

export async function loadLiveData() {
	// Only proceed if we're in the browser
	if (typeof window === 'undefined') {
		console.warn('loadLiveData called on server side, skipping');
		return;
	}

	birdnetData.update((store) => ({ ...store, liveLoading: true, liveError: '' }));

	try {
		const data = await fetchAllLiveDetections({ fetch: window.fetch });
		birdnetData.update((store) => ({
			...store,
			liveDetections: data || [],
			liveLastUpdated: Date.now(),
			liveLoading: false,
			liveError: ''
		}));
	} catch (error) {
		console.error('Error loading live data:', error);
		birdnetData.update((store) => ({
			...store,
			liveLoading: false,
			liveError: 'Failed to fetch live detections'
		}));
	}
}
