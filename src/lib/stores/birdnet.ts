import { writable } from 'svelte/store';
import { fetchAllSpecies } from '$lib/fetchSpecies';
import { fetchSpeciesDetails } from '$lib/fetchSpeciesDetails';

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

interface Summary {
	total_species: number;
	total_detections: number;
}
const initialLastUpdated = null;

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

export async function loadBirdnetData() {
	birdnetData.update((d) => ({ ...d, loading: true, error: null }));
	try {
		const species = await fetchAllSpecies({ fetch, period: 'all' });
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
				...detailsMap[key],
				id: String(s.id) // Set id last to guarantee it's a string
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
	} catch (e) {
		birdnetData.update((d) => ({
			...d,
			loading: false,
			error: e instanceof Error ? e.message : 'Unknown error'
		}));
	}
}

export const speciesStore = writable<Species[]>([]);
export const sortMode = writable<'last' | 'most'>('last');
export const search = writable('');
