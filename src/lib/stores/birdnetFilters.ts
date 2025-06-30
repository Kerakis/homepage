import { derived } from 'svelte/store';
import { birdnetData, sortMode, search } from '$lib/stores/birdnet';
import type { Species, LiveDetection } from '$lib/stores/birdnet';

// Your home GPS coordinates
const HOME_LAT = 35.954712;
const HOME_LON = -84.135071;
const MAX_DISTANCE_KM = 10; // Maximum distance in kilometers to include detections

// Calculate distance between two GPS coordinates using Haversine formula
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371; // Earth's radius in kilometers
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

// Check if a detection is near home location
export function isNearHome(detection: LiveDetection): boolean {
	if (detection.lat === undefined || detection.lon === undefined) {
		// If no GPS data, assume it's local (fallback for older data)
		return true;
	}
	const distance = calculateDistance(HOME_LAT, HOME_LON, detection.lat, detection.lon);
	return distance <= MAX_DISTANCE_KM;
}

// Check if a general detection is near home location
export function isDetectionNearHome(detection: { lat?: number; lon?: number }): boolean {
	if (detection.lat === undefined || detection.lon === undefined) {
		// If no GPS data, assume it's local (fallback for older data)
		return true;
	}
	const distance = calculateDistance(HOME_LAT, HOME_LON, detection.lat, detection.lon);
	return distance <= MAX_DISTANCE_KM;
}

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
		// First filter by GPS location
		const nearbyDetections = $data.liveDetections.filter(isNearHome);

		if (!$search.trim()) {
			return nearbyDetections;
		}
		return nearbyDetections.filter(
			(detection: LiveDetection) =>
				detection.species?.commonName.toLowerCase().includes($search.toLowerCase()) ||
				detection.species?.scientificName.toLowerCase().includes($search.toLowerCase())
		);
	}
);
