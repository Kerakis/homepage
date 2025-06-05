import type { Photo } from '$lib/types/photoTypes';

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
			return 'fa-otter';
		case 'reptiles':
			return 'fa-dragon';
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

export const MUSHROOM_SVG = `<svg width="32" height="32" viewBox="0 0 64 64" fill="none">
  <ellipse cx="32" cy="32" rx="28" ry="16" fill="#22304a"/>
  <ellipse cx="32" cy="32" rx="24" ry="12" fill="#fff" fill-opacity="0.1"/>
  <ellipse cx="22" cy="38" rx="4" ry="4" fill="#fff" fill-opacity="0.8"/>
  <ellipse cx="42" cy="36" rx="5" ry="5" fill="#fff" fill-opacity="0.8"/>
  <ellipse cx="32" cy="24" rx="28" ry="16" fill="#22304a"/>
  <ellipse cx="32" cy="24" rx="24" ry="12" fill="#fff" fill-opacity="0.1"/>
  <ellipse cx="22" cy="30" rx="4" ry="4" fill="#fff" fill-opacity="0.8"/>
  <ellipse cx="42" cy="28" rx="5" ry="5" fill="#fff" fill-opacity="0.8"/>
  <rect x="24" y="32" width="16" height="18" rx="6" fill="#22304a"/>
</svg>`;

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

	if (photo.subject === 'fungi' || photo.subject === 'mushrooms') {
		const svgOutlineStyle = `filter: drop-shadow(-1px -1px 0 ${outlineColor}) drop-shadow(1px -1px 0 ${outlineColor}) drop-shadow(-1px 1px 0 ${outlineColor}) drop-shadow(1px 1px 0 ${outlineColor});`;
		return `<span style="display: inline-block; line-height: 1; ${svgOutlineStyle}">${MUSHROOM_SVG}</span>`;
	}

	const iconClass = getIconClassForPhoto(photo);
	const iconFillColor = isCurrent ? '#e53e3e' : '#222';
	const faOutlineStyle = `text-shadow: -1px -1px 0 ${outlineColor}, 1px -1px 0 ${outlineColor}, -1px 1px 0 ${outlineColor}, 1px 1px 0 ${outlineColor};`;
	return `<i class="fa-solid ${iconClass}" style="font-size:2rem; color:${iconFillColor}; ${faOutlineStyle}"></i>`;
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
