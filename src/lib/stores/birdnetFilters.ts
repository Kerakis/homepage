import { derived } from 'svelte/store';
import { birdnetData, sortMode, search } from '$lib/stores/birdnet';
import type { Species, LiveDetection } from '$lib/stores/birdnet';
import type { Readable } from 'svelte/store';

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
	liveDetections: LiveDetection[];
	[key: string]: unknown; // For other properties we don't need to type strictly
};

function createFilteredSpecies(displayMode: 'all' | '24h'): Readable<Species[]> {
	// Return empty store for SSR, will be properly set up on client
	if (typeof window === 'undefined') {
		return derived([birdnetData], () => [] as Species[], [] as Species[]);
	}

	return derived(
		[birdnetData, sortMode, search],
		([$data, $sortMode, $search]: [BirdnetDataStore, string, string]): Species[] => {
			let species = $data.species;

			// Client-side filtering for 24h mode
			if (displayMode === '24h') {
				const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
				species = species.filter((s: Species) => {
					const detectionTime = new Date(s.latestDetectionAt).getTime();
					return detectionTime >= twentyFourHoursAgo;
				});
			}

			// Apply search filter
			let filtered = species.filter(
				(s: Species) =>
					s.commonName.toLowerCase().includes($search.toLowerCase()) ||
					s.scientificName.toLowerCase().includes($search.toLowerCase())
			);

			// Apply sort
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
		[] as Species[]
	);
}

export const filteredSpecies = createFilteredSpecies('all');
export const filteredSpecies24h = createFilteredSpecies('24h');

// Derive 24h stats from all-time data (client-side filtering)
export const stats24h: Readable<{ total_species: number; total_detections: number }> =
	typeof window === 'undefined'
		? derived([birdnetData], () => ({ total_species: 0, total_detections: 0 }), {
				total_species: 0,
				total_detections: 0
			})
		: derived(
				[birdnetData],
				([$data]: [BirdnetDataStore]): { total_species: number; total_detections: number } => {
					const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
					const species24h = $data.species.filter((s: Species) => {
						const detectionTime = new Date(s.latestDetectionAt).getTime();
						return detectionTime >= twentyFourHoursAgo;
					});

					return {
						total_species: species24h.length,
						total_detections: species24h.reduce((sum, s) => sum + (s.detections?.total ?? 0), 0)
					};
				},
				{ total_species: 0, total_detections: 0 }
			);

// Live detections filter (moved from birdnetLiveFilters.ts)
export const filteredLiveDetections: Readable<LiveDetection[]> =
	typeof window === 'undefined'
		? derived([birdnetData], () => [] as LiveDetection[], [] as LiveDetection[])
		: derived(
				[birdnetData, search],
				([$data, $search]: [BirdnetDataStore, string]): LiveDetection[] => {
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
				},
				[] as LiveDetection[]
			);
