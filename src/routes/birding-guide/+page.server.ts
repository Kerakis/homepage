import seasonalHotspotsData from '$lib/data/seasonal_hotspots.json';
import hotspotsData from '$lib/data/hotspots.json';
import statsData from '$lib/data/stats.json';

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

	return {
		hotspots: hotspots.slice(0, 10), // Top 10 hotspots by species count
		stats,
		seasonalHotspots
	};
}
