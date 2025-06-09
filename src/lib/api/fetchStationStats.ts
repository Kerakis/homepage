import { API_BASE_URL, STATION_ID } from '$lib/birdweatherConfig';

export async function fetchStationStats({
	fetch,
	since,
	period
}: {
	fetch: typeof window.fetch;
	since?: string;
	period?: string;
}) {
	let url = `${API_BASE_URL}/stations/${STATION_ID}/stats`;
	const params = [];
	if (since) params.push(`since=${since}`);
	if (period) params.push(`period=${period}`);
	if (params.length) url += `?${params.join('&')}`;
	const response = await fetch(url);
	if (!response.ok) throw new Error('Failed to fetch station stats');
	return await response.json();
}
