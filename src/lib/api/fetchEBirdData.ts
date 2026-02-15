const EBIRD_API_BASE = 'https://api.ebird.org/v2';
const API_KEY = import.meta.env.VITE_EBIRD_API_KEY;
const REGION_CODE = 'US-TN-093'; // Knox County, TN

interface EBirdHotspotResponse {
	locId: string;
	locName: string;
	lat: number;
	lng: number;
	numSpeciesAllTime?: number;
	subnational2Code?: string;
}

interface EBirdObservation {
	comName: string;
	sciName: string;
	obsDt: string;
	locId: string;
	locName: string;
}

export interface Hotspot {
	id: string;
	name: string;
	latitude: number;
	longitude: number;
	speciesCount: number;
	location: string;
}

export interface SeasonalHotspot {
	hotspotId: string;
	hotspotName: string;
	seasonalSpeciesCount: number;
	topSpecies: string[];
}

export interface SeasonalData {
	season: 'spring' | 'summer' | 'fall' | 'winter';
	hotspots: SeasonalHotspot[];
}

/**
 * Fetch hotspots for Knox County, TN with species counts
 */
export async function fetchKnoxCountyHotspots(): Promise<Hotspot[]> {
	if (!API_KEY) {
		console.warn('VITE_EBIRD_API_KEY not set');
		return [];
	}

	try {
		const response = await fetch(`${EBIRD_API_BASE}/ref/hotspot/${REGION_CODE}?fmt=json`, {
			headers: {
				'X-eBirdApiToken': API_KEY
			}
		});

		if (!response.ok) {
			throw new Error(`eBird API error: ${response.statusText}`);
		}

		const hotspots: EBirdHotspotResponse[] = await response.json();

		// Sort by all-time species count (descending)
		return hotspots
			.sort((a, b) => (b.numSpeciesAllTime ?? 0) - (a.numSpeciesAllTime ?? 0))
			.map((hotspot) => ({
				id: hotspot.locId,
				name: hotspot.locName,
				latitude: hotspot.lat,
				longitude: hotspot.lng,
				speciesCount: hotspot.numSpeciesAllTime ?? 0,
				location: hotspot.subnational2Code ?? ''
			}));
	} catch (error) {
		console.error('Error fetching eBird hotspots:', error);
		return [];
	}
}

/**
 * Fetch region historic observations for a specific date
 */
async function fetchRegionHistoricObservations(
	regionCode: string,
	year: number,
	month: number,
	day: number
): Promise<EBirdObservation[]> {
	try {
		const response = await fetch(
			`${EBIRD_API_BASE}/data/obs/${regionCode}/historic/${year}/${month}/${day}`,
			{
				headers: {
					'X-eBirdApiToken': API_KEY
				}
			}
		);

		if (!response.ok) {
			if (response.status !== 404) {
				console.warn(
					`Failed to fetch historic observations for ${regionCode} on ${year}-${month}-${day}: ${response.statusText}`
				);
			}
			return [];
		}

		return await response.json();
	} catch (error) {
		console.error(`Error fetching historic observations for ${regionCode}:`, error);
		return [];
	}
}

/**
 * Fetch seasonal hotspots based on unique seasonal species
 * Uses broad historic sampling across the region to identify seasonal patterns
 */
export async function fetchSeasonalHotspots(
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	days: number = 30 // Unused but kept for signature compatibility
): Promise<Record<'spring' | 'summer' | 'fall' | 'winter', SeasonalHotspot[]>> {
	if (!API_KEY) {
		console.warn('VITE_EBIRD_API_KEY not set');
		return { spring: [], summer: [], fall: [], winter: [] };
	}

	try {
		// 1. Get List of "Good" Hotspots First (Public, valid locations)
		const validHotspots = await fetchKnoxCountyHotspots();
		if (validHotspots.length === 0) {
			return { spring: [], summer: [], fall: [], winter: [] };
		}

		// Map of valid locIds to their names for quick lookup
		const validHotspotMap = new Map<string, string>();
		validHotspots.forEach((h) => validHotspotMap.set(h.id, h.name));

		// 2. Define Sampling Strategy
		// We need enough data to establish "presence" vs "absence" reliably.
		// Sampling 2 dates per month = 6 dates per season.
		// This gives us high confidence that resident birds (like Canada Goose)
		// will be detected in every season, preventing them from being flagged as "seasonal".
		const sampleYear = new Date().getFullYear() - 1;
		const sampleDates = [
			// Winter (Dec, Jan, Feb)
			{ s: 'winter', m: 12, d: 10 },
			{ s: 'winter', m: 12, d: 20 },
			{ s: 'winter', m: 1, d: 10 },
			{ s: 'winter', m: 1, d: 20 },
			{ s: 'winter', m: 2, d: 10 },
			{ s: 'winter', m: 2, d: 20 },

			// Spring (Mar, Apr, May)
			{ s: 'spring', m: 3, d: 10 },
			{ s: 'spring', m: 3, d: 20 },
			{ s: 'spring', m: 4, d: 10 },
			{ s: 'spring', m: 4, d: 20 },
			{ s: 'spring', m: 5, d: 10 },
			{ s: 'spring', m: 5, d: 20 },

			// Summer (Jun, Jul, Aug)
			{ s: 'summer', m: 6, d: 10 },
			{ s: 'summer', m: 6, d: 20 },
			{ s: 'summer', m: 7, d: 10 },
			{ s: 'summer', m: 7, d: 20 },
			{ s: 'summer', m: 8, d: 10 },
			{ s: 'summer', m: 8, d: 20 },

			// Fall (Sep, Oct, Nov)
			{ s: 'fall', m: 9, d: 10 },
			{ s: 'fall', m: 9, d: 20 },
			{ s: 'fall', m: 10, d: 10 },
			{ s: 'fall', m: 10, d: 20 },
			{ s: 'fall', m: 11, d: 10 },
			{ s: 'fall', m: 11, d: 20 }
		] as const;

		// 3. Fetch Region-Wide Data in Parallel
		// We fetch data for the whole county, then filter by our hotspot list locally.
		// This is much more efficient than querying each hotspot individually.
		const requests = sampleDates.map((date) =>
			fetchRegionHistoricObservations(REGION_CODE, sampleYear, date.m, date.d).then((obs) => ({
				season: date.s,
				obs
			}))
		);

		const results = await Promise.all(requests);

		// 4. Aggregate Data by Hotspot and Season
		// locId -> season -> Set<Species>
		const hotspotSeasonalSpecies: Record<string, Record<string, Set<string>>> = {};

		for (const batch of results) {
			const { season, obs } = batch;
			for (const observation of obs) {
				// Only consider data from our valid public hotspots list
				if (validHotspotMap.has(observation.locId)) {
					if (!hotspotSeasonalSpecies[observation.locId]) {
						hotspotSeasonalSpecies[observation.locId] = {
							spring: new Set(),
							summer: new Set(),
							fall: new Set(),
							winter: new Set()
						};
					}
					hotspotSeasonalSpecies[observation.locId][season].add(observation.comName);
				}
			}
		}

		// 5. Analyze Uniqueness
		const finalResult: Record<'spring' | 'summer' | 'fall' | 'winter', SeasonalHotspot[]> = {
			spring: [],
			summer: [],
			fall: [],
			winter: []
		};
		const supportedSeasons = ['spring', 'summer', 'fall', 'winter'] as const;

		for (const locId in hotspotSeasonalSpecies) {
			const hotspotName = validHotspotMap.get(locId) || 'Unknown Hotspot';
			const speciesMap = hotspotSeasonalSpecies[locId];

			for (const season of supportedSeasons) {
				const speciesInSeason = speciesMap[season];

				// Identify species found ONLY in this season for this hotspot
				const uniqueSpecies = Array.from(speciesInSeason).filter((species) => {
					// Must NOT be present in any other season
					const inSpring = season !== 'spring' && speciesMap['spring'].has(species);
					const inSummer = season !== 'summer' && speciesMap['summer'].has(species);
					const inFall = season !== 'fall' && speciesMap['fall'].has(species);
					const inWinter = season !== 'winter' && speciesMap['winter'].has(species);

					return !(inSpring || inSummer || inFall || inWinter);
				});

				if (uniqueSpecies.length > 0) {
					finalResult[season].push({
						hotspotId: locId,
						hotspotName: hotspotName,
						seasonalSpeciesCount: uniqueSpecies.length,
						topSpecies: uniqueSpecies.slice(0, 5)
					});
				}
			}
		}

		// 6. Sort by number of seasonal specialties
		supportedSeasons.forEach((s) => {
			finalResult[s].sort((a, b) => b.seasonalSpeciesCount - a.seasonalSpeciesCount);
			// Limit to top 20 per season for display
			finalResult[s] = finalResult[s].slice(0, 20);
		});

		return finalResult;
	} catch (error) {
		console.error('Error fetching seasonal hotspots:', error);
		return { spring: [], summer: [], fall: [], winter: [] };
	}
}

/**
 * Fetch regional statistics for Knox County
 */
export async function fetchRegionStats(): Promise<{
	totalSpecies: number;
	totalObservations: number;
}> {
	if (!API_KEY) {
		console.warn('VITE_EBIRD_API_KEY not set');
		return { totalSpecies: 0, totalObservations: 0 };
	}

	try {
		const response = await fetch(`${EBIRD_API_BASE}/product/spplist/${REGION_CODE}?fmt=json`, {
			headers: {
				'X-eBirdApiToken': API_KEY
			}
		});

		if (!response.ok) {
			throw new Error(`eBird API error: ${response.statusText}`);
		}

		const species = await response.json();

		return {
			totalSpecies: species.length,
			totalObservations: 0 // This would require additional API calls
		};
	} catch (error) {
		console.error('Error fetching region stats:', error);
		return { totalSpecies: 0, totalObservations: 0 };
	}
}
