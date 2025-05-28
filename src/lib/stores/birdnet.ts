import { writable } from 'svelte/store';
import { fetchAllSpecies } from '$lib/fetchSpecies';
import { fetchSpeciesDetails } from '$lib/fetchSpeciesDetails';

interface Species {
	scientificName: string;
	commonName: string;
	detections?: {
		total: number;
	};
}

interface Summary {
	total_species: number;
	total_detections: number;
}

const stored =
	typeof localStorage !== 'undefined' ? localStorage.getItem('birdnet:lastUpdated') : null;
const initialLastUpdated = stored ? Number(stored) : null;

export const birdnetData = writable<{
	species: Species[];
	summary: Summary;
	lastUpdated: number | null;
	loading: boolean;
	error: string | null;
}>({
	species: [],
	summary: { total_species: 0, total_detections: 0 },
	lastUpdated: initialLastUpdated,
	loading: true,
	error: null
});

// When you update lastUpdated, also update localStorage:
birdnetData.subscribe((value) => {
	if (typeof localStorage !== 'undefined' && value.lastUpdated) {
		localStorage.setItem('birdnet:lastUpdated', String(value.lastUpdated));
	}
});

export async function loadBirdnetData() {
	birdnetData.update((d) => ({ ...d, loading: true, error: null }));
	try {
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
		const lastUpdated = Date.now();
		birdnetData.set({
			species: speciesWithDetails,
			summary,
			lastUpdated,
			loading: false,
			error: null
		});
		// Optionally cache in localStorage
		if (typeof window !== 'undefined') {
			localStorage.setItem(
				'birdnet:species',
				JSON.stringify({ species: speciesWithDetails, summary, lastUpdated })
			);
		}
	} catch (e) {
		birdnetData.update((d) => ({
			...d,
			loading: false,
			error: e instanceof Error ? e.message : 'Unknown error'
		}));
	}
}
