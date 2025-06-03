<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto, afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import ImageModal from './ImageModal.svelte';

	interface Photo {
		src: string;
		thumbnailSrc: string;
		filename: string;
		title: string;
		date: string;
		camera?: string;
		lens?: string;
		focalLength?: string;
		aperture?: string;
		exposure?: string;
		iso?: number;
		gps?: { lat: number; lon: number } | null;
		subject?: string;
		section?: string;
	}

	const folderThumbCache = new Map<string, Photo>();

	let gallery: { section: string; photos: Photo[] }[] = [];
	let breadcrumbs: string[] = [];
	let modalOpen = false;
	let modalPhoto: Photo | null = null;
	let modalIndex = 0;
	let touchStartX: number | null = null;
	let zoomed = false;

	// Fetch gallery data on mount
	onMount(async () => {
		const res = await fetch('/photos/photos.json');
		gallery = await res.json();
		updatePathVars();
	});

	function updatePathVars() {
		currentPath = page.url.searchParams.get('path') || '';
		currentSection = gallery.find((s) => s.section === currentPath);
		breadcrumbs = currentPath ? currentPath.split('/') : [];
		subSections = Array.from(
			new Set(
				gallery
					.filter((s) => s.section.startsWith(currentPath) && s.section !== currentPath)
					.map((s) => {
						const rest = s.section.slice(currentPath.length).replace(/^\//, '');
						return rest.split('/')[0];
					})
					.filter(Boolean)
			)
		);
	}

	afterNavigate(() => {
		updatePathVars();
	});

	// Reactively update currentPath from the URL
	$: currentPath = page.url.searchParams.get('path') || '';

	// Find photos at the current path (if any)
	$: currentSection = gallery.find((s) => s.section === currentPath);

	// Update breadcrumbs whenever currentPath changes
	$: breadcrumbs = currentPath ? currentPath.split('/') : [];

	// Find all unique next-level sections at the current path
	$: subSections = Array.from(
		new Set(
			gallery
				.filter((s) => s.section.startsWith(currentPath) && s.section !== currentPath)
				.map((s) => {
					const rest = s.section.slice(currentPath.length).replace(/^\//, '');
					return rest.split('/')[0];
				})
				.filter(Boolean)
		)
	);

	// Optional: Reactively update modal state from the URL
	$: {
		const params = page.url.searchParams;
		const modalParam = params.has('modal');
		const photoFilenameParam = params.get('photo'); // Get the filename

		if (modalParam && currentSection && photoFilenameParam !== null) {
			// Find the photo by filename (or src if it's more unique/reliable)
			const photoToOpen = currentSection.photos.find((p) => p.filename === photoFilenameParam);

			if (photoToOpen) {
				const idx = currentSection.photos.indexOf(photoToOpen);
				if (idx !== -1) {
					modalOpen = true;
					modalPhoto = photoToOpen;
					modalIndex = idx;
				} else {
					// Photo found but somehow not in the array, should not happen if find works
					modalOpen = false;
					modalPhoto = null;
				}
			} else {
				// Photo with that filename not found in the current section
				modalOpen = false;
				modalPhoto = null;
			}
		} else {
			modalOpen = false;
			modalPhoto = null;
		}
	}

	function countPhotosInSection(section: string): number {
		return gallery
			.filter((s) => s.section === section || s.section.startsWith(section + '/'))
			.reduce((sum, s) => sum + (s.photos?.length || 0), 0);
	}

	function enterSection(section: string) {
		const newPath = currentPath ? `${currentPath}/${section}` : section;
		const params = new URLSearchParams(page.url.search);
		params.set('path', newPath);
		goto(`${window.location.pathname}?${params.toString()}`);
	}

	function goToBreadcrumb(idx: number) {
		const newPath = breadcrumbs.slice(0, idx + 1).join('/');
		const params = new URLSearchParams(page.url.search);
		params.set('path', newPath);
		goto(`${window.location.pathname}?${params.toString()}`);
	}

	function goHome() {
		const params = new URLSearchParams(page.url.search);
		params.delete('path');
		goto(`${window.location.pathname}?${params.toString()}`);
	}

	function openModal(photo: Photo, i: number) {
		modalOpen = true;
		modalPhoto = photo;
		modalIndex = i;
		const params = new URLSearchParams(page.url.search);
		params.set('modal', '1');
		params.set('photo', photo.filename); // Changed from i.toString()
		goto(`${window.location.pathname}?${params.toString()}`, { replaceState: true });
	}

	function closeModal() {
		modalOpen = false;
		modalPhoto = null;
		const params = new URLSearchParams(page.url.search);
		if (params.has('modal')) {
			params.delete('modal');
			params.delete('photo');
			goto(`${window.location.pathname}?${params.toString()}`, { replaceState: true });
		}
	}

	function showPrev() {
		if (!currentSection) return;
		modalIndex = (modalIndex - 1 + currentSection.photos.length) % currentSection.photos.length;
		modalPhoto = currentSection.photos[modalIndex];
		const params = new URLSearchParams(page.url.search);
		params.set('photo', modalIndex.toString());
		goto(`${window.location.pathname}?${params.toString()}`, { replaceState: true });
	}

	function showNext() {
		if (!currentSection) return;
		modalIndex = (modalIndex + 1) % currentSection.photos.length;
		modalPhoto = currentSection.photos[modalIndex];
		const params = new URLSearchParams(page.url.search);
		params.set('photo', modalIndex.toString());
		goto(`${window.location.pathname}?${params.toString()}`, { replaceState: true });
	}

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
	}

	function handleTouchEnd(e: TouchEvent) {
		if (zoomed) return; // Prevent swipe navigation while zoomed
		if (touchStartX === null) return;
		const touchEndX = e.changedTouches[0].clientX;
		const dx = touchEndX - touchStartX;
		if (Math.abs(dx) > 50) {
			if (dx > 0) {
				showPrev();
			} else {
				showNext();
			}
		}
		touchStartX = null;
	}

	// Prevent background scroll when modal is open
	$: {
		if (browser) {
			// Add this check
			if (modalOpen) {
				document.body.style.overflow = 'hidden';
			} else {
				document.body.style.overflow = '';
			}
		}
	}

	onDestroy(() => {
		if (browser) {
			// Add this check
			document.body.style.overflow = '';
		}
	});

	function formatDate(dateStr: string) {
		const [year, month, day] = dateStr.split(/[: ]/);
		const date = new Date(`${year}-${month}-${day}`);
		return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
	}

	function formatMonthYear(dateStr: string): string {
		if (!dateStr) return '';
		// Assuming dateStr is like "YYYY:MM:DD HH:MM:SS" or "YYYY-MM-DD"
		const parts = dateStr.split(/[:\s-/]/);
		const year = parseInt(parts[0], 10);
		const month = parseInt(parts[1], 10); // 1-indexed month from EXIF
		if (isNaN(year) || isNaN(month)) return '';
		const date = new Date(year, month - 1); // Date constructor needs 0-indexed month
		return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
	}

	function getAllPhotosInSection(section: string) {
		return gallery
			.filter((s) => s.section === section || s.section.startsWith(section + '/'))
			.flatMap((s) => s.photos ?? []);
	}

	function getMonthYearDateRangeForSection(sectionPath: string): string {
		const photos = getAllPhotosInSection(sectionPath);
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

	function getDateRangeForSection(section: string) {
		const photos = getAllPhotosInSection(section);
		if (!photos.length) return '';
		const dates = photos.map((p) => {
			const [year, month, day] = p.date.split(/[: ]/);
			return new Date(`${year}-${month}-${day}`);
		});
		const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
		const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
		const formattedMin = minDate.toLocaleDateString(undefined, {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
		const formattedMax = maxDate.toLocaleDateString(undefined, {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
		return formattedMin === formattedMax ? formattedMin : `${formattedMin} – ${formattedMax}`;
	}

	function getRandomPhotoInSection(sectionPath: string): Photo | undefined {
		if (folderThumbCache.has(sectionPath)) {
			return folderThumbCache.get(sectionPath);
		}
		const sectionData = gallery.find((s) => s.section === sectionPath);
		if (sectionData && sectionData.photos.length > 0) {
			const photo = sectionData.photos[Math.floor(Math.random() * sectionData.photos.length)];
			folderThumbCache.set(sectionPath, photo);
			return photo;
		}
		// If no exact match, try to find in sub-sections (though less ideal for a specific section thumb)
		const photosInSection = gallery
			.filter((s) => s.section.startsWith(sectionPath))
			.flatMap((s) => s.photos);
		if (photosInSection.length > 0) {
			const photo = photosInSection[Math.floor(Math.random() * photosInSection.length)];
			folderThumbCache.set(sectionPath, photo); // Cache even if it's from a sub-section
			return photo;
		}
		return undefined;
	}
</script>

<!-- Breadcrumbs -->
<nav class="mb-6 text-sm text-gray-400" aria-label="Breadcrumb">
	{#if currentPath}
		<button type="button" on:click={goHome} class="text-accent-red hover:underline"
			>Photo Gallery</button
		>
		{#each breadcrumbs as crumb, i}
			<span>/</span>
			{#if i < breadcrumbs.length - 1}
				<button
					type="button"
					on:click={() => goToBreadcrumb(i)}
					class="text-accent-red hover:underline"
				>
					{crumb.charAt(0).toUpperCase() + crumb.slice(1)}
				</button>
			{:else}
				<span class="font-bold">{crumb.charAt(0).toUpperCase() + crumb.slice(1)}</span>
			{/if}
		{/each}
	{:else}
		<span class="font-bold">Photo Gallery</span>
	{/if}
</nav>

<!-- Section or Photo Grid -->
{#if subSections.length}
	<!-- Show next-level sections as cards -->
	<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
		{#each subSections as sub (sub)}
			{@const thumb = getRandomPhotoInSection(currentPath ? `${currentPath}/${sub}` : sub)}
			{@const dateRangeStr = getMonthYearDateRangeForSection(
				currentPath ? `${currentPath}/${sub}` : sub
			)}
			<!-- Moved {@const} here -->
			<button
				type="button"
				class="group relative h-80 cursor-pointer overflow-hidden border-[8px] border-black bg-gray-200 shadow-md transition-all duration-300 ease-in-out hover:shadow-xl dark:border-white dark:bg-gray-800"
				on:click={() => enterSection(sub)}
				aria-label={`View section ${sub}`}
			>
				<!-- Image fills the button directly -->
				{#if thumb}
					<img
						src={thumb.thumbnailSrc ?? thumb.src}
						alt={`Preview for ${sub}`}
						class="absolute inset-0 h-full w-full object-cover transition-transform duration-150 ease-in-out group-hover:scale-105"
						loading="lazy"
					/>
				{:else}
					<div
						class="flex h-full w-full items-center justify-center text-gray-600 dark:text-gray-300"
					>
						<span class="text-sm">No preview</span>
					</div>
				{/if}

				<!-- Combined Text Area at the bottom -->
				<div class="absolute right-0 bottom-0 left-0 bg-black/50 p-3 text-white">
					<div class="flex flex-row items-end gap-2">
						<!-- Left side: Title and Count, stacked and left-aligned -->
						<div class="flex flex-grow flex-col items-start">
							<h3 class="text-md truncate leading-tight font-semibold">
								{sub.charAt(0).toUpperCase() + sub.slice(1)}
							</h3>
							<p class="text-xs leading-tight opacity-80">
								{countPhotosInSection(currentPath ? `${currentPath}/${sub}` : sub)} photos
							</p>
						</div>
						<!-- Right side: Date Range, bottom right -->
						{#if dateRangeStr}
							<p class="flex-shrink-0 text-right text-xs leading-tight opacity-80">
								{dateRangeStr}
							</p>
						{/if}
					</div>
				</div>
			</button>
		{/each}
	</div>
{:else if currentSection}
	<!-- Show photos in this section -->
	<div class="masonry">
		{#each currentSection.photos as photo, i (photo.src)}
			<button
				type="button"
				class="photo-thumb group relative mb-4 w-full cursor-pointer overflow-hidden border-[8px] border-black bg-gray-200 shadow-md transition-all duration-300 ease-in-out hover:shadow-xl dark:border-white dark:bg-gray-800"
				on:click={() => openModal(photo, i)}
				aria-label={`View photo ${photo.title}`}
			>
				<!-- Image fills the button directly -->
				<img
					src={photo.thumbnailSrc ?? photo.src}
					alt={photo.title}
					class="block w-full object-cover transition-transform duration-150 ease-in-out group-hover:scale-105"
					loading="lazy"
				/>

				<!-- Combined Text Area at the bottom -->
				<div class="absolute right-0 bottom-0 left-0 bg-black/50 p-3 text-white">
					<div class="flex items-end justify-between gap-2">
						<!-- Left side: Title -->
						<div>
							<h4 class="text-md truncate leading-tight font-semibold">{photo.title}</h4>
						</div>
						<!-- Right side: Date -->
						<p class="flex-shrink-0 text-xs leading-tight opacity-80">
							{formatMonthYear(photo.date)}
						</p>
					</div>
				</div>
			</button>
		{/each}
	</div>
{:else}
	<p class="text-center text-gray-500">No photos found in this section.</p>
{/if}

<!-- ImageModal -->
<ImageModal
	open={modalOpen}
	photos={currentSection?.photos ?? []}
	allPhotos={gallery.flatMap(
		(
			sectionEntry // Consider optimizing this if 'allPhotos' is very large for the map
		) =>
			sectionEntry.photos.map((p) => ({
				...p,
				section: sectionEntry.section
			}))
	)}
	index={modalIndex}
	section={currentSection ? { photos: currentSection.photos, name: currentSection.section } : null}
	onClose={closeModal}
	onChange={(idx) => {
		modalIndex = idx;
		if (currentSection) {
			if (currentSection.photos && currentSection.photos[modalIndex]) {
				modalPhoto = currentSection.photos[modalIndex];
			} else {
				modalPhoto = null;
			}
		}
	}}
/>
