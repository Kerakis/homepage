import {
	fetchKnoxCountyHotspots,
	fetchRegionStats,
	fetchSeasonalHotspots,
	type Hotspot,
	type SeasonalHotspot
} from '$lib/api/fetchEBirdData';

// Simple in-memory cache with 24-hour TTL
interface CacheEntry<T> {
	data: T;
	timestamp: number;
}

interface CacheData {
	hotspots: Hotspot[];
	stats: { totalSpecies: number; totalObservations: number };
	seasonalHotspots: Record<'spring' | 'summer' | 'fall' | 'winter', SeasonalHotspot[]>;
}

const cache: Partial<Record<keyof CacheData, CacheEntry<unknown>>> = {};
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

function getCached<K extends keyof CacheData>(key: K): CacheData[K] | null {
	const entry = cache[key];
	if (!entry) return null;

	const now = Date.now();
	if (now - entry.timestamp > CACHE_TTL) {
		delete cache[key];
		return null;
	}

	return entry.data as CacheData[K];
}

function setCached<K extends keyof CacheData>(key: K, data: CacheData[K]): void {
	cache[key] = {
		data,
		timestamp: Date.now()
	};
}

export async function load() {
	// Check cache first
	const cachedHotspots = getCached('hotspots');
	const cachedStats = getCached('stats');
	const cachedSeasonalHotspots = getCached('seasonalHotspots');

	if (cachedHotspots && cachedStats && cachedSeasonalHotspots) {
		console.log('Using cached eBird data');
		return {
			hotspots: cachedHotspots.slice(0, 10),
			stats: cachedStats,
			seasonalHotspots: cachedSeasonalHotspots
		};
	}

	// Fetch fresh data
	console.log('Fetching fresh eBird data');
	const [hotspots, stats] = await Promise.all([fetchKnoxCountyHotspots(), fetchRegionStats()]);

	// Try to fetch seasonal hotspots, but provide defaults if it fails
	let seasonalHotspots = await fetchSeasonalHotspots(730);

	// If we couldn't get seasonal data from API, provide template data
	if (
		!seasonalHotspots.spring.length &&
		!seasonalHotspots.summer.length &&
		!seasonalHotspots.fall.length &&
		!seasonalHotspots.winter.length
	) {
		console.log('Using placeholder seasonal hotspot data - API configuration needed');
		seasonalHotspots = {
			spring: [],
			summer: [],
			fall: [],
			winter: []
		};
	}

	// Cache the results
	setCached('hotspots', hotspots);
	setCached('stats', stats);
	setCached('seasonalHotspots', seasonalHotspots);

	return {
		hotspots: hotspots.slice(0, 10), // Top 10 hotspots
		stats,
		seasonalHotspots
	};
}
