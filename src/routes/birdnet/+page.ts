import { fetchAllSpecies } from '$lib/fetchSpecies';
import { fetchSpeciesDetails } from '$lib/fetchSpeciesDetails';

interface SpeciesDetail {
	id: string; // Stays as string, matching documentation for JSON response
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

interface CachedData {
	species: SpeciesDetail[];
	summary: Summary;
	lastUpdated: number;
}

let cachedData: CachedData | null = null;
const CACHE_KEY = 'birdnet:species';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function loadFromLocalStorage(): CachedData | null {
	try {
		if (typeof window !== 'undefined') {
			const raw = localStorage.getItem(CACHE_KEY);
			if (raw) return JSON.parse(raw) as CachedData;
		}
	} catch (e) {
		console.error('Error loading from localStorage:', e);
	}
	return null;
}

function saveToLocalStorage(data: CachedData) {
	try {
		if (typeof window !== 'undefined') {
			localStorage.setItem(CACHE_KEY, JSON.stringify(data));
		}
	} catch (e) {
		console.error('Error saving to localStorage:', e);
	}
}

export async function load({ fetch, depends }) {
	depends(CACHE_KEY);

	if (typeof window !== 'undefined' && !cachedData) {
		cachedData = loadFromLocalStorage();
	}

	if (cachedData && cachedData.lastUpdated) {
		const now = Date.now();
		if (now - cachedData.lastUpdated > TWENTY_FOUR_HOURS_MS) {
			cachedData = null;
			if (typeof window !== 'undefined') {
				localStorage.removeItem(CACHE_KEY);
			}
		}
	}

	if (cachedData) {
		return { speciesData: Promise.resolve(cachedData) };
	}

	const speciesPromise = (async (): Promise<CachedData> => {
		// Assuming 'speciesFromApi' is the raw result from fetchAllSpecies
		// and it might have 'id' as a number.
		const speciesFromApi = await fetchAllSpecies({ fetch, period: 'all' });
		const summary: Summary = {
			total_species: speciesFromApi.length,
			total_detections: speciesFromApi.reduce((sum, s) => sum + (s.detections?.total ?? 0), 0)
		};
		const identifiers = speciesFromApi.map((s) => `${s.scientificName}_${s.commonName}`);
		const detailsMap = await fetchSpeciesDetails(identifiers, fetch);

		const speciesWithDetails: SpeciesDetail[] = speciesFromApi.map((s) => {
			const key = `${s.scientificName}_${s.commonName}`;
			const details = detailsMap[key] || {};
			// Explicitly create the object matching SpeciesDetail
			return {
				...s, // 1. Spread other properties from s first
				...details, // 2. Spread details from detailsMap
				id: String(s.id) // 3. Ensure id is a string, this will overwrite s.id if it was numeric
			};
		});

		const result: CachedData = {
			species: speciesWithDetails,
			summary,
			lastUpdated: Date.now()
		};

		cachedData = result;
		saveToLocalStorage(result);

		return result;
	})();

	return {
		speciesData: speciesPromise
	};
}
