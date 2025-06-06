export type SpeciesDetails = {
	id: string;
	commonName: string;
	scientificName: string;
	color: string;
	imageUrl: string;
	thumbnailUrl: string;
	wikipediaUrl?: string;
	wikipediaSummary?: string;
	ebirdUrl?: string;
};

export async function fetchSpeciesDetails(identifiers: string[], fetch: typeof window.fetch) {
	const res = await fetch('https://app.birdweather.com/api/v1/species/lookup', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ species: identifiers })
	});
	if (!res.ok) throw new Error('Failed to fetch species details');
	const data = await res.json();
	return data.species as Record<string, SpeciesDetails>;
}
