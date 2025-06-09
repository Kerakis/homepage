import { fetchAllSpecies } from '$lib/api/fetchSpecies';
import { fetchSpeciesDetails } from '$lib/api/fetchSpeciesDetails';

interface SpeciesDetail {
	id: string;
	scientificName: string;
	commonName: string;
	detections?: {
		total: number;
	};
	wikipediaSummary?: string;
	wikipediaUrl?: string;
	ebirdUrl?: string;
	latestDetectionAt?: string;
	imageUrl?: string;
}

interface Summary {
	total_species: number;
	total_detections: number;
}

const CACHE_KEY = 'birdnet:species';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const CACHE_VERSION = 2; // Increment this if you change the cache structure

interface CachedData {
	species: SpeciesDetail[];
	summary: Summary;
	lastUpdated: number;
	version: number; // Add this
}

// Consolidate cache management functions
const cacheManager = {
	load(): CachedData | null {
		try {
			if (typeof window !== 'undefined') {
				const raw = localStorage.getItem(CACHE_KEY);
				if (raw) {
					const data = JSON.parse(raw) as CachedData;
					// Check if cache is still valid and version matches
					if (
						data.version === CACHE_VERSION &&
						Date.now() - data.lastUpdated <= TWENTY_FOUR_HOURS_MS
					) {
						return data;
					}
					// Cache expired or version mismatch, remove it
					localStorage.removeItem(CACHE_KEY);
				}
			}
		} catch (e) {
			console.error('Error loading from localStorage:', e);
		}
		return null;
	},

	save(data: CachedData): void {
		try {
			if (typeof window !== 'undefined') {
				localStorage.setItem(CACHE_KEY, JSON.stringify(data));
			}
		} catch (e) {
			console.error('Error saving to localStorage:', e);
		}
	},

	clear(): void {
		try {
			if (typeof window !== 'undefined') {
				localStorage.removeItem(CACHE_KEY);
			}
		} catch (e) {
			console.error('Error clearing localStorage:', e);
		}
	}
};

let cachedData: CachedData | null = null;

export async function load({ fetch, depends }) {
	depends(CACHE_KEY);

	// Try to load from cache first (only on client-side)
	if (typeof window !== 'undefined' && !cachedData) {
		cachedData = cacheManager.load();
	}

	// If we have valid cached data, return it
	if (cachedData) {
		return { speciesData: Promise.resolve(cachedData) };
	}

	// No valid cache, fetch fresh data
	const speciesPromise = fetchFreshData(fetch);

	return {
		speciesData: speciesPromise
	};
}

async function fetchFreshData(fetch: typeof window.fetch): Promise<CachedData> {
	try {
		// Fetch species data
		const speciesFromApi = await fetchAllSpecies({ fetch, period: 'all' });

		// Calculate summary stats
		const summary: Summary = {
			total_species: speciesFromApi.length,
			total_detections: speciesFromApi.reduce((sum, s) => sum + (s.detections?.total ?? 0), 0)
		};

		// Fetch additional details for all species
		const identifiers = speciesFromApi.map((s) => `${s.scientificName}_${s.commonName}`);
		const detailsMap = await fetchSpeciesDetails(identifiers, fetch);

		// Merge species data with details
		const speciesWithDetails: SpeciesDetail[] = speciesFromApi.map((s) => {
			const key = `${s.scientificName}_${s.commonName}`;
			const details = detailsMap[key] || {};
			return {
				...s,
				...details,
				id: String(s.id) // Ensure id is always a string
			};
		});

		// Create the final cached data object
		const result: CachedData = {
			species: speciesWithDetails,
			summary,
			lastUpdated: Date.now(),
			version: CACHE_VERSION // Add version here
		};

		// Update in-memory cache and save to localStorage
		cachedData = result;
		cacheManager.save(result);

		return result;
	} catch (error) {
		console.error('Error fetching fresh species data:', error);
		throw error;
	}
}
