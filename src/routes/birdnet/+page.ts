import { fetchAllSpecies } from '$lib/fetchSpecies';
import { fetchSpeciesDetails } from '$lib/fetchSpeciesDetails';

let cachedData: { species: any[]; summary: any; lastUpdated: number } | null = null;

function loadFromLocalStorage() {
	try {
		const raw = localStorage.getItem('birdnet:species');
		if (raw) return JSON.parse(raw);
	} catch {}
	return null;
}

function saveToLocalStorage(data: any) {
	try {
		localStorage.setItem('birdnet:species', JSON.stringify(data));
	} catch {}
}

export async function load({ fetch, depends }) {
	depends('birdnet:species');

	if (typeof window !== 'undefined' && !cachedData) {
		cachedData = loadFromLocalStorage();
	}
	if (cachedData) {
		return { speciesData: Promise.resolve(cachedData) };
	}

	const speciesPromise = (async () => {
		const species = await fetchAllSpecies({ fetch });
		const summary = {
			total_species: species.length,
			total_detections: species.reduce((sum, s) => sum + (s.detections?.total ?? 0), 0)
		};
		const identifiers = species.map((s) => `${s.scientificName}_${s.commonName}`);
		const detailsMap = await fetchSpeciesDetails(identifiers, fetch);
		const speciesWithDetails = species.map((s) => {
			const key = `${s.scientificName}_${s.commonName}`;
			return {
				...s,
				...detailsMap[key]
			};
		});
		const result = { species: speciesWithDetails, summary, lastUpdated: Date.now() };
		cachedData = result;
		if (typeof window !== 'undefined') saveToLocalStorage(result);
		return result;
	})();

	return {
		speciesData: speciesPromise
	};
}
