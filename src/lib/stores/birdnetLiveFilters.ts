import { derived, writable } from 'svelte/store';
import type { LiveDetection } from '$lib/fetchLiveDetections';

export const liveDetectionsStore = writable<LiveDetection[]>([]);
import { search } from '$lib/stores/birdnet';

export const filteredLiveDetections = derived(
	[liveDetectionsStore, search],
	([$liveDetections, $search]) => {
		if (!$search.trim()) {
			return $liveDetections;
		}
		return $liveDetections.filter(
			(detection: LiveDetection) =>
				detection.species?.commonName.toLowerCase().includes($search.toLowerCase()) ||
				detection.species?.scientificName.toLowerCase().includes($search.toLowerCase())
		);
	}
);
