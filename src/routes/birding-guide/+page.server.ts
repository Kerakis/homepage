import seasonalHotspotsData from '$lib/data/seasonal_hotspots.json';
import hotspotsData from '$lib/data/hotspots.json';
import statsData from '$lib/data/stats.json';
import speciesLocationsData from '$lib/data/species_locations.json';
import ebirdTaxonomyData from '$lib/data/ebird_taxonomy.json';

// Define strict types for the JSON data structure
interface NotableSpecies {
	name: string;
	score: number;
	frequency: number;
	regionFrequency: number;
	obsCount: number;
	yearsPresent: number;
	yearsTotal: number;
}

interface RareSpecies {
	name: string;
	obsCount: number;
	lastSeenYear: number;
	frequency: number;
}

interface SeasonalHotspot {
	hotspotId: string;
	hotspotName: string;
	latitude: number;
	longitude: number;
	seasonalSpeciesCount: number;
	notableSpecies: NotableSpecies[];
	rareSpecies?: RareSpecies[];
}

interface SeasonalData {
	spring: SeasonalHotspot[];
	summer: SeasonalHotspot[];
	fall: SeasonalHotspot[];
	winter: SeasonalHotspot[];
}

interface Hotspot {
	id: string;
	name: string;
	latitude: number;
	longitude: number;
	speciesCount: number;
}

export async function load() {
	// Cast the imported JSON to the correct type
	const seasonalHotspots = seasonalHotspotsData as unknown as SeasonalData;
	const hotspots = hotspotsData as unknown as Hotspot[];
	const stats = statsData;
	const speciesLocations = speciesLocationsData;

	const taxonomyMap = new Map((ebirdTaxonomyData as any[]).map((s) => [s.comName, s]));
	const speciesSearchData: Record<string, { sciName: string; codes: string[] }> = {};

	for (const speciesName of Object.keys(speciesLocations)) {
		const tax = taxonomyMap.get(speciesName);
		if (tax) {
			speciesSearchData[speciesName] = {
				sciName: tax.sciName,
				codes: [
					...(tax.bandingCodes || []),
					...(tax.comNameCodes || []),
					...(tax.sciNameCodes || [])
				]
			};
		}
	}

	return {
		hotspots: hotspots.slice(0, 10), // Top 10 hotspots by species count
		stats,
		seasonalHotspots,
		speciesLocations,
		speciesSearchData
	};
}
