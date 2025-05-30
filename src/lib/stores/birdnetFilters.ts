import { derived } from 'svelte/store';
import { speciesStore, sortMode, search } from '$lib/stores/birdnet';
import type { Species } from '$lib/stores/birdnet';

export const filteredSpecies = derived(
	[speciesStore, sortMode, search],
	([$species, $sortMode, $search]: [Species[], string, string]) => {
		let filtered = $species.filter(
			(s) =>
				s.commonName.toLowerCase().includes($search.toLowerCase()) ||
				s.scientificName.toLowerCase().includes($search.toLowerCase())
		);
		if ($sortMode === 'last') {
			filtered = filtered.sort(
				(a, b) => new Date(b.latestDetectionAt).getTime() - new Date(a.latestDetectionAt).getTime()
			);
		} else {
			filtered = filtered.sort((a, b) => (b.detections?.total ?? 0) - (a.detections?.total ?? 0));
		}
		return filtered;
	},
	[]
);
