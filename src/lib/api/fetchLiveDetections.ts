import type { Species } from '$lib/stores/birdnet';

export interface LiveDetection {
	id: number;
	species: Species;
	timestamp: string;
	confidence?: number;
	lat?: number;
	lon?: number;
	soundscape?: {
		url: string;
		startTime?: number;
	};
}

export async function fetchAllLiveDetections({
	fetch
}: {
	fetch: typeof window.fetch;
}): Promise<LiveDetection[]> {
	let allDetections: LiveDetection[] = [];
	let cursor: number | undefined = undefined;
	const now = new Date();
	const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

	const from = thirtyMinutesAgo.toISOString();
	const to = now.toISOString();

	let lastDetectionId: number | undefined = undefined;
	while (true) {
		let url = `https://app.birdweather.com/api/v1/stations/5026/detections?limit=100&order=desc&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
		if (cursor !== undefined) url += `&cursor=${cursor}`;
		const response = await fetch(url);
		const data = await response.json();
		const detections: LiveDetection[] = data.detections || [];
		if (detections.length === 0) break;

		if (lastDetectionId !== undefined && detections[0]?.id === lastDetectionId) {
			detections.shift();
		}

		allDetections = [...allDetections, ...detections];

		if (detections.length < 100) break;

		const oldest = detections[detections.length - 1];
		lastDetectionId = oldest?.id;
		cursor = oldest?.id;
	}
	return allDetections;
}
