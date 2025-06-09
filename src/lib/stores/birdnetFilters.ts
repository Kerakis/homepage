import { derived } from 'svelte/store';
import { birdnetData, sortMode, search } from '$lib/stores/birdnet';
import type { Species, LiveDetection } from '$lib/stores/birdnet';

// Define proper type for the store data
type BirdnetDataStore = {
	species: Species[];
	species24h: Species[];
	liveDetections: LiveDetection[];
	[key: string]: unknown; // For other properties we don't need to type strictly
};

function createFilteredSpecies(displayMode: 'all' | '24h') {
	return derived(
		[birdnetData, sortMode, search],
		([$data, $sortMode, $search]: [BirdnetDataStore, string, string]) => {
			const species = displayMode === '24h' ? $data.species24h : $data.species;

			let filtered = species.filter(
				(s: Species) =>
					s.commonName.toLowerCase().includes($search.toLowerCase()) ||
					s.scientificName.toLowerCase().includes($search.toLowerCase())
			);

			if ($sortMode === 'last') {
				filtered = filtered.sort(
					(a: Species, b: Species) =>
						new Date(b.latestDetectionAt).getTime() - new Date(a.latestDetectionAt).getTime()
				);
			} else {
				filtered = filtered.sort(
					(a: Species, b: Species) => (b.detections?.total ?? 0) - (a.detections?.total ?? 0)
				);
			}

			return filtered;
		},
		[]
	);
}

export const filteredSpecies = createFilteredSpecies('all');
export const filteredSpecies24h = createFilteredSpecies('24h');

// Live detections filter (moved from birdnetLiveFilters.ts)
export const filteredLiveDetections = derived(
	[birdnetData, search],
	([$data, $search]: [BirdnetDataStore, string]) => {
		if (!$search.trim()) {
			return $data.liveDetections;
		}
		return $data.liveDetections.filter(
			(detection: LiveDetection) =>
				detection.species?.commonName.toLowerCase().includes($search.toLowerCase()) ||
				detection.species?.scientificName.toLowerCase().includes($search.toLowerCase())
		);
	}
);
