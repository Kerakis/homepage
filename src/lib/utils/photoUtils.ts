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

export const MUSHROOM_SVG = `<svg width="100%" height="100%" viewBox="0 0 64 64" fill="none" preserveAspectRatio="xMidYMid meet">
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

export const TURTLE_SVG = `<svg fill="#000000" height="100%" width="100%" version="1.2" baseProfile="tiny" id="_x31_" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
      viewBox="0 0 256 175" xml:space="preserve" preserveAspectRatio="xMidYMid meet">
<path d="M185,29.7v0.2l15-12.6c-11.4-6.1-23.9-9.5-37.5-9.5s-26.2,3.4-37.1,9.3l15,12.6L185,29.7L185,29.7z M105.1,93.2
    c-24.7,0-45,20.3-45,45v4.5l0,0c0.2,9.5,7.9,17,17.4,17s17.2-7.5,17.4-17l0,0v-4.5c0-5.7,4.5-10.1,10.1-10.1
    c9.7,0,17.6-7.9,17.6-17.6S114.8,93.2,105.1,93.2z M221.9,92.8c-9.7,0-17.6,7.9-17.6,17.6v32.4l0,0c0.4,9.3,7.9,16.8,17.4,16.8
    s17-7.5,17.4-16.8l0,0v-32.7C239.3,100.5,231.4,92.8,221.9,92.8z M252.7,101.9c0-4.3-1.4-8.5-3.4-12c-2.2,1.6-4.7,2.6-7.7,2.6
    c4.1,4.9,6.5,11,6.5,17.6v5.5C251.3,111.8,252.7,107,252.7,101.9z M131.7,110.6c0,5.7-1.8,10.7-4.7,15c11.6,2.6,23.5,4.1,35.7,4.1
    c11.4,0,22.1-1.2,32.7-3.4v-16c0-6.5,2.4-12.6,6.3-17h-76.5C129,98,131.7,103.9,131.7,110.6z M125,93.4L125,93.4c0.2,0,0-0.2,0-0.2
    V93.4z M245.8,79.6c0-2.4-2-4.7-4.5-4.7h-0.6c-3.4-21.7-15.4-40.6-32.7-52.5l-17.6,14.8c9.7,11.4,16.4,24.1,20.3,37.9h-9.5
    c-4.3-13-11.4-25.6-21.5-35.9h-32.9c-10.1,10.5-17,22.7-21.5,35.9h-9.5c3.9-13.4,10.3-26,19.9-36.9l-18.5-15.6
    c-17,12.2-29.4,30.8-32.7,52.5h-1.2c-2.4,0-4.5,2-4.5,4.5c0,2.4,2,4.5,4.5,4.5h157.8C243.8,84.1,245.8,82,245.8,79.6z M81.6,89.5
    c-4.9-0.6-8.9-4.7-8.9-9.9v-8.9c0-18.7-15-33.9-33.9-33.9c-18.7,0-33.9,15-33.9,33.9v8.9c0,4.9,4.1,8.9,8.9,8.9h24.5
    c2.2,11.4,8.5,20.7,17.6,27.4C61.1,104.3,70.2,95.2,81.6,89.5z M24.2,64.4c-3,0-5.7-2.4-5.7-5.7c0-3,2.4-5.7,5.7-5.7
    s5.7,2.4,5.7,5.7C29.8,61.9,27.4,64.4,24.2,64.4z"/>
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
	const svgOutlineFilterStyle = `filter: drop-shadow(-1px -1px 0 ${outlineColor}) drop-shadow(1px -1px 0 ${outlineColor}) drop-shadow(-1px 1px 0 ${outlineColor}) drop-shadow(1px 1px 0 ${outlineColor});`;

	// Style for the SVG wrapper to match FA icon size (2.5rem) and alignment
	const svgWrapperStyle = `display: inline-block; width: 2.5rem; height: 2.5rem; vertical-align: middle; ${svgOutlineFilterStyle}`;

	if (photo.subject === 'fungi' || photo.subject === 'mushrooms') {
		return `<span style="${svgWrapperStyle}">${MUSHROOM_SVG}</span>`;
	} else if (photo.subject === 'reptiles') {
		return `<span style="${svgWrapperStyle}">${TURTLE_SVG}</span>`;
	}

	const iconClass = getIconClassForPhoto(photo);
	const iconFillColor = isCurrent ? '#e53e3e' : '#222';
	const faOutlineTextStyle = `text-shadow: -1px -1px 0 ${outlineColor}, 1px -1px 0 ${outlineColor}, -1px 1px 0 ${outlineColor}, 1px 1px 0 ${outlineColor};`;
	// Style for FA icons, ensuring consistent display and alignment
	const faIconStyle = `font-size: 2rem; color: ${iconFillColor}; display: inline-block; vertical-align: middle; ${faOutlineTextStyle}`;
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
