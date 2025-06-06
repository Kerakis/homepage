import type { Photo } from '$lib/types/photoTypes';
import mushroomSvg from '$lib/assets/mushroom.svg?raw';
import turtleSvg from '$lib/assets/turtle.svg?raw';

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

// Returns the FontAwesome icon class for a photo subject
export function getIconClassForPhoto(photo: { subject?: string }): string {
	switch (photo.subject) {
		case 'bugs':
			return 'fa-bug';
		case 'spiders':
			return 'fa-spider';
		case 'birds':
			return 'fa-crow';
		case 'plants':
		case 'flowers':
			return 'fa-seedling';
		case 'mammals':
			return 'fa-paw';
		case 'amphibians':
			return 'fa-frog';
		case 'fish':
			return 'fa-fish';
		case 'landscape':
			return 'fa-mountain';
		case 'architecture':
			return 'fa-building';
		case 'people':
			return 'fa-user';
		case 'vehicles':
			return 'fa-car';
		case 'food':
			return 'fa-utensils';
		case 'art':
			return 'fa-palette';
		case 'dogs':
			return 'fa-dog';
		case 'cats':
			return 'fa-cat';
		case 'night':
			return 'fa-moon';
		default:
			return 'fa-image';
	}
}

export const MUSHROOM_SVG = mushroomSvg;
export const TURTLE_SVG = turtleSvg;

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

// Marker HTML generation
export function getMarkerHtml(photo: Photo, isCurrent: boolean): string {
	const outlineColor = '#FFF';
	const svgOutlineFilterStyle = `filter: drop-shadow(-1px -1px 0 ${outlineColor}) drop-shadow(1px -1px 0 ${outlineColor}) drop-shadow(-1px 1px 0 ${outlineColor}) drop-shadow(1px 1px 0 ${outlineColor});`;

	// Style for the SVG wrapper to match FA icon size (2.5rem) and alignment
	const svgWrapperStyle = `display: inline-block; width: 2.5rem; height: 2.5rem; vertical-align: middle; ${svgOutlineFilterStyle}`;
	const iconFillColor = isCurrent ? '#e53e3e' : '#000000'; // Determine fill color

	if (photo.subject === 'fungi' || photo.subject === 'mushrooms') {
		const coloredMushroomSvg = MUSHROOM_SVG.replace('fill="#000000"', `fill="${iconFillColor}"`);
		return `<span style="${svgWrapperStyle}">${coloredMushroomSvg}</span>`;
	} else if (photo.subject === 'reptiles') {
		const coloredTurtleSvg = TURTLE_SVG.replace('fill="#000000"', `fill="${iconFillColor}"`);
		return `<span style="${svgWrapperStyle}">${coloredTurtleSvg}</span>`;
	}

	const iconClass = getIconClassForPhoto(photo);
	// For FA icons, the color is applied via CSS 'color' property
	const faIconFillColor = isCurrent ? '#e53e3e' : '#222';
	const faOutlineTextStyle = `text-shadow: -1px -1px 0 ${outlineColor}, 1px -1px 0 ${outlineColor}, -1px 1px 0 ${outlineColor}, 1px 1px 0 ${outlineColor};`;
	// Style for FA icons, ensuring consistent display and alignment
	const faIconStyle = `font-size: 2rem; color: ${faIconFillColor}; display: inline-block; vertical-align: middle; ${faOutlineTextStyle}`;
	return `<i class="fa-solid ${iconClass}" style="${faIconStyle}"></i>`;
}

export function getPhotoPopupHtml(p: Photo, isCurrent: boolean, isButton: boolean = false) {
	return `
        <div class="flex flex-col items-center text-center max-w-xs">
            <img src="${p.thumbnailSrc ?? p.src}" alt="${p.title || 'Photo'}"
                class="mb-2 rounded max-w-full" style="width:140px;" loading="lazy" />
            <strong class="text-lg font-bold mb-1">${p.title || 'Untitled'}</strong>
            ${
							isButton && p.section && p.filename && !isCurrent
								? `<button
                        type="button"
                        class="mt-2 inline-block rounded border border-neutral-900 bg-neutral-700 px-4 py-2 font-bold text-white shadow transition hover:bg-neutral-900 dark:border-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-300 cursor-pointer"
                        style="min-width: 80px;"
                        data-photo-src="${p.src}"
                        data-photo-section="${p.section}"
                        data-photo-filename="${p.filename}"
                    >
                        View
                    </button>`
								: ''
						}
        </div>
    `;
}

// Add this function to photoUtils.ts
export function isValidDate(date: Date): boolean {
	return date instanceof Date && !isNaN(date.getTime()) && date.getTime() > 0;
}

// Keep this function in photoUtils.ts for reuse
export function parseExifDate(dateStr: string | null | undefined): Date {
	if (!dateStr) return new Date(0); // Use epoch for null dates
	// Convert EXIF format (2025:05:14 12:56:48) to ISO format
	const isoFormat = dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
	return new Date(isoFormat);
}
