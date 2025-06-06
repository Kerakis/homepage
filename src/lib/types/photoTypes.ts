export interface Photo {
	gps?: { lat: number; lon: number } | null;
	subject?: string;
	section?: string;
	filename?: string;
	src?: string;
	thumbnailSrc?: string;
	title?: string;
	date?: string;
	camera?: string;
	lens?: string;
	focalLength?: string;
	aperture?: string;
	exposure?: string;
	iso?: number;
}
