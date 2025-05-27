import { API_BASE_URL, STATION_ID } from '$lib/birdweatherConfig';

export type Species = {
	id: number;
	commonName: string;
	scientificName: string;
	color: string;
	imageUrl: string;
	thumbnailUrl: string;
	detections: {
		total: number;
		almostCertain: number;
		veryLikely: number;
		uncertain: number;
		unlikely: number;
	};
	latestDetectionAt: string;
};

type PageData = {
	species: Species[];
	success: boolean;
};

export async function fetchAllSpecies({
	stationId = STATION_ID,
	lang = 'en',
	fetch
}: {
	stationId?: string;
	lang?: string;
	period?: string;
	fetch: typeof window.fetch;
}) {
	let allResults: Species[] = [];
	let currentPage = 1;
	const url = `${API_BASE_URL}/stations/${stationId}/species?locale=${lang}&period=all`;

	while (true) {
		const response = await fetch(`${url}&page=${currentPage}`);
		if (!response.ok) {
			const errorResponse = await response.json();
			throw new Error(`Error: ${response.status} ${errorResponse?.message}`);
		}
		const pageData: PageData = await response.json();
		allResults = [...allResults, ...pageData.species];
		if (pageData.species.length < 100) break;
		currentPage++;
	}
	return allResults;
}
