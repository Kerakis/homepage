<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto, afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import ImageModal from './ImageModal.svelte';
	import type { Photo } from '$lib/types/photoTypes';
	import {
		formatMonthYear,
		getRandomPhotoInSection,
		getMonthYearDateRangeForSection,
		countPhotosInSection,
		parseExifDate,
		isValidDate
	} from '$lib/utils/photoUtils';

	const folderThumbCache = new Map<string, Photo>();

	let gallery: { section: string; photos: Photo[] }[] = [];
	let currentPath = '';
	let currentSection: { section: string; photos: Photo[] } | undefined;
	let subSections: string[] = [];
	let breadcrumbs: string[] = [];
	let modalOpen = false;
	let modalIndex = 0;

	// Fetch gallery data on mount
	onMount(async () => {
		const res = await fetch('/photos/photos.json');
		gallery = await res.json();
		updatePathVars();
	});

	function updatePathVars() {
		if (browser) {
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
	}

	afterNavigate(() => {
		updatePathVars();
	});

	// Reactively update currentPath from the URL
	$: currentPath = browser ? page.url.searchParams.get('path') || '' : '';

	// Find photos at the current path (if any)
	$: currentSection = gallery.find((s) => s.section === currentPath);

	// Update breadcrumbs whenever currentPath changes
	$: breadcrumbs = currentPath ? currentPath.split('/') : [];

	// Find all unique next-level sections at the current path and sort alphabetically
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
	).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

	// Sort photos by date (most recent first) when displaying them
	$: sortedPhotos =
		currentSection?.photos.slice().sort((a, b) => {
			const dateA = parseExifDate(a.date);
			const dateB = parseExifDate(b.date);

			// If both dates are invalid or epoch, fall back to filename comparison
			if (!isValidDate(dateA) && !isValidDate(dateB)) {
				return (a.filename || '').localeCompare(b.filename || '');
			}

			// If one date is invalid, prioritize the valid one
			if (!isValidDate(dateA)) return 1;
			if (!isValidDate(dateB)) return -1;

			// Both dates are valid, sort by date (newest first)
			return dateB.getTime() - dateA.getTime();
		}) || [];

	$: if (browser) {
		const params = page.url.searchParams;
		const modalParam = params.has('modal');
		const photoFilenameParam = params.get('photo'); // Get the filename

		if (modalParam && sortedPhotos.length > 0 && photoFilenameParam !== null) {
			// Find the photo by filename in the SORTED photos array
			const photoToOpen = sortedPhotos.find((p) => p.filename === photoFilenameParam);

			if (photoToOpen) {
				const idx = sortedPhotos.indexOf(photoToOpen);
				if (idx !== -1) {
					modalOpen = true;
					modalIndex = idx;
				} else {
					modalOpen = false;
				}
			} else {
				// Photo with that filename not found in the current section
				modalOpen = false;
			}
		} else {
			modalOpen = false;
		}
	}

	function enterSection(section: string) {
		if (!browser) return;
		const newPath = currentPath ? `${currentPath}/${section}` : section;
		const params = new URLSearchParams(page.url.search);
		params.set('path', newPath);
		goto(`${window.location.pathname}?${params.toString()}`);
	}

	function goToBreadcrumb(idx: number) {
		if (!browser) return;
		const newPath = breadcrumbs.slice(0, idx + 1).join('/');
		const params = new URLSearchParams(page.url.search);
		params.set('path', newPath);
		goto(`${window.location.pathname}?${params.toString()}`);
	}

	function goHome() {
		if (!browser) return;
		const params = new URLSearchParams(page.url.search);
		params.delete('path');
		goto(`${window.location.pathname}?${params.toString()}`);
	}

	function openModal(photo: Photo, i: number) {
		if (!browser) return;
		modalOpen = true;
		modalIndex = i;
		const params = new URLSearchParams(page.url.search);
		params.set('modal', '1');
		params.set('photo', photo.filename ?? '');
		goto(`${window.location.pathname}?${params.toString()}`, { replaceState: false });
	}

	function closeModal() {
		if (!browser) return;
		modalOpen = false;
		const params = new URLSearchParams(page.url.search);
		if (params.has('modal')) {
			params.delete('modal');
			params.delete('photo');
			goto(`${window.location.pathname}?${params.toString()}`, { replaceState: true });
		}
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
</script>

<svelte:head>
	<title>Kerakis // Photos</title>
</svelte:head>

<!-- Breadcrumbs -->
<nav class="mb-6 text-sm text-black dark:text-white" aria-label="Breadcrumb">
	{#if currentPath}
		<button
			type="button"
			on:click={goHome}
			class="nav-underline cursor-pointer text-black dark:text-white">Photo Gallery</button
		>
		{#each breadcrumbs as crumb, i}
			<span class="text-accent mx-1">/</span>
			{#if i < breadcrumbs.length - 1}
				<button
					type="button"
					on:click={() => goToBreadcrumb(i)}
					class="nav-underline cursor-pointer text-black dark:text-white"
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
	<div
		class="grid justify-center gap-6"
		style="grid-template-columns: repeat(auto-fill, minmax(342px, 342px)); justify-content: center;"
	>
		{#each subSections as sub (sub)}
			{@const thumb = getRandomPhotoInSection(
				gallery,
				currentPath ? `${currentPath}/${sub}` : sub,
				folderThumbCache
			)}
			{@const dateRangeStr = getMonthYearDateRangeForSection(
				gallery,
				currentPath ? `${currentPath}/${sub}` : sub
			)}
			{@const count = countPhotosInSection(gallery, currentPath ? `${currentPath}/${sub}` : sub)}
			<button
				type="button"
				class="group relative h-80 w-[342px] cursor-pointer overflow-hidden border-[8px] border-black bg-gray-200 shadow-md transition-all duration-300 ease-in-out hover:shadow-xl dark:border-white dark:bg-gray-800"
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
								{count}
								{count === 1 ? 'photo' : 'photos'}
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
	<div
		class="grid justify-center gap-6"
		style="grid-template-columns: repeat(auto-fill, minmax(342px, 342px)); justify-content: center;"
	>
		{#each sortedPhotos as photo, i (photo.src)}
			<button
				type="button"
				class="group relative h-80 w-[342px] cursor-pointer overflow-hidden border-[8px] border-black bg-gray-200 shadow-md transition-all duration-300 ease-in-out hover:shadow-xl dark:border-white dark:bg-gray-800"
				on:click={() => openModal(photo, i)}
				aria-label={`View photo ${photo.title}`}
			>
				<img
					src={photo.thumbnailSrc ?? photo.src}
					alt={photo.title}
					class="absolute inset-0 h-full w-full object-cover transition-transform duration-150 ease-in-out group-hover:scale-105"
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
							{formatMonthYear(photo.date ?? '')}
						</p>
					</div>
				</div>
			</button>
		{/each}
	</div>
{:else}
	<p class="text-center text-gray-500">No photos found in this section.</p>
{/if}

<ImageModal
	open={modalOpen}
	photos={sortedPhotos}
	allPhotos={gallery.flatMap((sectionEntry) =>
		sectionEntry.photos.map((p) => ({
			...p,
			section: sectionEntry.section
		}))
	)}
	index={modalIndex}
	section={currentSection ? { photos: sortedPhotos, name: currentSection.section } : null}
	onClose={closeModal}
	onChange={(idx) => {
		modalIndex = idx;
	}}
/>
