import { API_BASE_URL, STATION_ID } from '$lib/birdweatherConfig';

export type Detection = {
	id: number;
	timestamp: string;
	lat?: number;
	lon?: number;
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
	since,
	order = 'desc',
	fetch
}: {
	speciesId?: number;
	stationId?: string;
	lang?: string;
	limit?: number;
	since?: string;
	order?: 'asc' | 'desc';
	fetch: typeof window.fetch;
}) {
	let url = `${API_BASE_URL}/stations/${stationId}/detections?limit=${limit}&locale=${lang}&order=${order}`;
	if (speciesId !== undefined) url += `&speciesId=${speciesId}`;
	if (since) url += `&since=${since}`;

	const response = await fetch(url);
	if (!response.ok) {
		const errorResponse = await response.json();
		throw new Error(`Error: ${response.status} ${errorResponse?.message}`);
	}
	const data: DetectionsResponse = await response.json();
	return data.detections;
}
