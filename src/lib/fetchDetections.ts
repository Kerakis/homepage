import { API_BASE_URL, STATION_ID } from '$lib/birdweatherConfig';

export type Detection = {
	id: number;
	timestamp: string;
	soundscape: {
		url: string;
		startTime: number;
	};
};

type DetectionsResponse = {
	detections: Detection[];
	success: boolean;
};

export async function fetchDetections({
	speciesId,
	stationId = STATION_ID,
	lang = 'en',
	limit = 5,
	fetch
}: {
	speciesId: number;
	stationId?: string;
	lang?: string;
	limit?: number;
	fetch: typeof window.fetch;
}) {
	const url = `${API_BASE_URL}/stations/${stationId}/detections?limit=${limit}&speciesId=${speciesId}&locale=${lang}&order=desc`;
	const response = await fetch(url);
	if (!response.ok) {
		const errorResponse = await response.json();
		throw new Error(`Error: ${response.status} ${errorResponse?.message}`);
	}
	const data: DetectionsResponse = await response.json();
	return data.detections;
}
