<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto, afterNavigate } from '$app/navigation';
	import { ImageViewer } from 'svelte-image-viewer';
	import { page } from '$app/state';
	import ImageModal from './ImageModal.svelte';

	interface Photo {
		src: string;
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
	}

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
		const photoParam = params.get('photo');
		if (modalParam && currentSection && photoParam !== null) {
			const idx = parseInt(photoParam, 10);
			if (!isNaN(idx) && currentSection.photos[idx]) {
				modalOpen = true;
				modalPhoto = currentSection.photos[idx];
				modalIndex = idx;
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
		params.set('photo', i.toString());
		goto(`${window.location.pathname}?${params.toString()}`);
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
		if (modalOpen) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
	}

	onDestroy(() => {
		document.body.style.overflow = '';
	});
</script>

<!-- Breadcrumbs -->
<nav class="mb-4 flex items-center gap-2 text-sm">
	{#if currentPath}
		<button type="button" on:click={goHome} class="text-accent-red hover:underline">Home</button>
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
		<span class="font-bold">Home</span>
	{/if}
</nav>

<!-- Section or Photo Grid -->
{#if subSections.length}
	<!-- Show next-level sections as cards -->
	<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
		{#each subSections as sub}
			<button
				type="button"
				class="cursor-pointer rounded border p-6 text-left shadow transition hover:bg-gray-800"
				on:click={() => enterSection(sub)}
			>
				<div class="mb-2 text-xl font-bold">{sub.charAt(0).toUpperCase() + sub.slice(1)}</div>
				{#if gallery.find((s) => s.section === (currentPath ? `${currentPath}/${sub}` : sub))?.photos[0]}
					<img
						src={gallery.find((s) => s.section === (currentPath ? `${currentPath}/${sub}` : sub))
							?.photos[0]?.src}
						alt={sub}
						class="h-48 w-full rounded object-cover"
					/>
				{/if}
				<div class="mt-2 text-xs text-gray-400">
					{countPhotosInSection(currentPath ? `${currentPath}/${sub}` : sub)} photos
				</div>
			</button>
		{/each}
	</div>
{:else if currentSection}
	<!-- Show photos in this section -->
	<div class="masonry">
		{#each currentSection.photos as photo, i}
			<button
				type="button"
				class="photo-thumb mb-4 w-full cursor-pointer rounded border p-2 text-left shadow"
				on:click={() => openModal(photo, i)}
			>
				<img src={photo.src} alt={photo.title} class="mb-2 w-full rounded" />
				<div class="text-sm font-semibold">{photo.title}</div>
				<div class="text-xs text-gray-500">{photo.date}</div>
			</button>
		{/each}
	</div>
{:else}
	<p class="text-center text-gray-500">No photos found in this section.</p>
{/if}

<ImageModal
	open={modalOpen}
	photos={currentSection?.photos ?? []}
	index={modalIndex}
	section={currentSection}
	on:close={closeModal}
	on:change={(e) => {
		modalIndex = e.detail.index;
		if (currentSection) {
			modalPhoto = currentSection.photos[modalIndex];
		}
	}}
/>
