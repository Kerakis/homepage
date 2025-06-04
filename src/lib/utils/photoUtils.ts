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

// List of valid photo subjects
export const PHOTO_SUBJECTS = [
	'bugs',
	'spiders',
	'birds',
	'plants',
	'flowers',
	'mammals',
	'reptiles',
	'amphibians',
	'fish',
	'landscape',
	'architecture',
	'people',
	'vehicles',
	'food',
	'art',
	'dogs',
	'cats',
	'night',
	'fungi',
	'mushrooms'
];

// Type guard
export function isPhoto(obj: unknown): obj is Photo {
	return !!obj && typeof obj === 'object' && 'src' in obj && 'filename' in obj;
}

// Format date for display
export function formatPhotoDate(dateStr: string): string {
	if (!dateStr) return '';
	const [year, month, day] = dateStr.split(/[: ]/);
	const date = new Date(`${year}-${month}-${day}`);
	return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

// Format month/year for display
export function formatMonthYear(dateStr: string): string {
	if (!dateStr) return '';
	const parts = dateStr.split(/[:\s-/]/);
	const year = parseInt(parts[0], 10);
	const month = parseInt(parts[1], 10);
	if (isNaN(year) || isNaN(month)) return '';
	const date = new Date(year, month - 1);
	return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

// Returns a random photo from a section or its sub-sections
export function getRandomPhotoInSection(
	gallery: { section: string; photos: Photo[] }[],
	sectionPath: string,
	cache?: Map<string, Photo>
): Photo | undefined {
	if (cache && cache.has(sectionPath)) {
		return cache.get(sectionPath);
	}
	const sectionData = gallery.find((s) => s.section === sectionPath);
	if (sectionData && sectionData.photos.length > 0) {
		const photo = sectionData.photos[Math.floor(Math.random() * sectionData.photos.length)];
		cache?.set(sectionPath, photo);
		return photo;
	}
	const photosInSection = gallery
		.filter((s) => s.section.startsWith(sectionPath))
		.flatMap((s) => s.photos);
	if (photosInSection.length > 0) {
		const photo = photosInSection[Math.floor(Math.random() * photosInSection.length)];
		cache?.set(sectionPath, photo);
		return photo;
	}
	return undefined;
}

// Returns a month-year date range string for a section
export function getMonthYearDateRangeForSection(
	gallery: { section: string; photos: Photo[] }[],
	sectionPath: string
): string {
	const photos = getAllPhotosInSection(gallery, sectionPath);
	if (!photos || photos.length === 0) return '';

	const dates = photos
		.map((p) => {
			if (!p.date) return null;
			const parts = p.date.split(/[:\s-/]/);
			const year = parseInt(parts[0], 10);
			const month = parseInt(parts[1], 10);
			if (isNaN(year) || isNaN(month)) return null;
			return new Date(year, month - 1);
		})
		.filter((d) => d !== null) as Date[];

	if (dates.length === 0) return '';

	const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
	const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

	const formattedMin = minDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
	const formattedMax = maxDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

	return formattedMin === formattedMax ? formattedMin : `${formattedMin} – ${formattedMax}`;
}

// Returns all photos in a section and its sub-sections
export function getAllPhotosInSection(
	gallery: { section: string; photos: Photo[] }[],
	section: string
): Photo[] {
	return gallery
		.filter((s) => s.section === section || s.section.startsWith(section + '/'))
		.flatMap((s) => s.photos ?? []);
}

// Returns the count of all photos in a section and its sub-sections
export function countPhotosInSection(
	gallery: { section: string; photos: Photo[] }[],
	section: string
): number {
	return getAllPhotosInSection(gallery, section).length;
}
