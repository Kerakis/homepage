<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto, afterNavigate } from '$app/navigation';
	import { ImageViewer } from 'svelte-image-viewer';
	import { page } from '$app/state';

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
	let modalContainer: HTMLDivElement | null = null;
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

	// Focus modal for keyboard navigation
	$: if (modalOpen && modalContainer) {
		setTimeout(() => modalContainer && modalContainer.focus(), 0);
	}
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

<!-- Photo Modal -->
{#if modalOpen && modalPhoto}
	<div
		bind:this={modalContainer}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
		role="dialog"
		aria-modal="true"
		tabindex="0"
		on:keydown={(e) => {
			if (!zoomed) {
				if (e.key === 'ArrowLeft') showPrev();
				if (e.key === 'ArrowRight') showNext();
			}
			if (e.key === 'Escape') {
				if (zoomed) zoomed = false;
				else closeModal();
			}
			setTimeout(() => modalContainer && modalContainer.focus(), 0);
		}}
		on:click={() => setTimeout(() => modalContainer && modalContainer.focus(), 0)}
	>
		<!-- Overlay for closing modal -->
		<button
			type="button"
			aria-label="Close photo modal"
			class="absolute inset-0"
			on:click={closeModal}
			tabindex="-1"
			style="background: transparent; border: none; padding: 0; margin: 0;"
		></button>

		<!-- Modal content -->
		<div
			class="relative z-10 flex h-screen max-h-none w-screen max-w-none flex-col bg-transparent"
			role="presentation"
			on:click|self={() => setTimeout(() => modalContainer && modalContainer.focus(), 0)}
			on:click|stopPropagation
		>
			<!-- Top bar -->
			<div class="flex w-full items-center justify-between px-6 pt-6 pb-2">
				<!-- Counter styled like arrow buttons -->
				{#if currentSection}
					<div class="flex items-center rounded-full bg-black/60 px-4 py-2 text-xs text-white">
						<svg class="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
							><circle cx="12" cy="12" r="10" stroke-width="2" /></svg
						>
						<span>{modalIndex + 1} / {currentSection.photos.length}</span>
					</div>
				{/if}
				<div class="flex items-center gap-2">
					<!-- Zoom icon styled like arrow buttons -->
					<button
						class="flex items-center justify-center rounded-full bg-black/60 p-3 text-white transition hover:bg-gray-700"
						on:click={() => {
							zoomed = !zoomed;
							if (zoomed) {
								// Optionally, trigger zoom-to-1:1 if your ImageViewer supports it
							}
						}}
						aria-label={zoomed ? 'Disable zoom/pan' : 'Enable zoom/pan'}
					>
						{#if zoomed}
							<!-- Magnifier minus SVG -->
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-6 w-6"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								><circle cx="11" cy="11" r="7" stroke-width="2" /><path
									stroke-width="2"
									d="M21 21l-4.35-4.35"
								/><path stroke-width="2" d="M8 11h6" /></svg
							>
						{:else}
							<!-- Magnifier plus SVG -->
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-6 w-6"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								><circle cx="11" cy="11" r="7" stroke-width="2" /><path
									stroke-width="2"
									d="M21 21l-4.35-4.35"
								/><path stroke-width="2" d="M11 8v6M8 11h6" /></svg
							>
						{/if}
					</button>
					<!-- Close icon styled like arrow buttons -->
					<button
						class="flex items-center justify-center rounded-full bg-black/60 p-3 text-xl text-white transition hover:bg-gray-700"
						on:click={closeModal}
						aria-label="Close"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							><path stroke-linecap="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg
						>
					</button>
				</div>
			</div>

			<!-- Image area -->
			<div
				class="group relative flex flex-1 items-center justify-center select-none"
				style="min-height:0;"
				aria-label="Next or previous photo"
				role="button"
				tabindex="0"
				on:click={(e) => {
					if (e.target instanceof HTMLElement && !e.target.closest('button')) {
						if (!zoomed) {
							const bounds = e.currentTarget.getBoundingClientRect();
							const x = e.clientX - bounds.left;
							if (x < bounds.width / 2) showPrev();
							else showNext();
						}
						requestAnimationFrame(() => modalContainer && modalContainer.focus());
					}
				}}
				on:keydown={(e) => {
					if (e.target !== e.currentTarget) return; // Only handle if this div is focused
					if (zoomed) return;
					if (e.key === 'Enter' || e.key === ' ') {
						// Default to next photo on Enter/Space
						showNext();
						requestAnimationFrame(() => modalContainer && modalContainer.focus());
						e.preventDefault();
					}
				}}
				on:touchstart={handleTouchStart}
				on:touchend={handleTouchEnd}
			>
				<!-- Left arrow (always visible on desktop) -->
				{#if !zoomed}
					<button
						class="absolute top-1/2 left-4 z-20 -translate-y-1/2 rounded-full bg-black/20 p-3 text-white md:flex"
						on:click|stopPropagation={() => {
							showPrev();
							requestAnimationFrame(() => modalContainer && modalContainer.focus());
						}}
						tabindex="-1"
						aria-label="Previous photo"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-7 w-7"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 19l-7-7 7-7"
							/></svg
						>
					</button>
				{/if}

				<!-- ImageViewer or plain img depending on zoomed state -->
				{#if zoomed}
					<ImageViewer src={modalPhoto.src} alt={modalPhoto.title} />
				{:else}
					<img
						src={modalPhoto.src}
						alt={modalPhoto.title}
						class="max-h-full max-w-full object-contain select-none"
						draggable="false"
						tabindex="-1"
					/>
				{/if}

				<!-- Right arrow (always visible on desktop) -->
				{#if !zoomed}
					<button
						class="absolute top-1/2 right-4 z-20 -translate-y-1/2 rounded-full bg-black/20 p-3 text-white md:flex"
						on:click|stopPropagation={() => {
							showNext();
							requestAnimationFrame(() => modalContainer && modalContainer.focus());
						}}
						tabindex="-1"
						aria-label="Next photo"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-7 w-7"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/></svg
						>
					</button>
				{/if}
			</div>

			<!-- EXIF/Title block (below image) -->
			<div class="w-full bg-black/70 p-4 text-white dark:bg-black/80">
				<div class="text-lg font-bold">{modalPhoto.title}</div>
				<div class="text-sm">{modalPhoto.date}</div>
				<div class="mt-1 text-xs">
					{modalPhoto.camera}
					{modalPhoto.lens}
					{modalPhoto.focalLength ? ` | ${modalPhoto.focalLength}` : ''}
					{modalPhoto.aperture ? ` | ${modalPhoto.aperture}` : ''}
					{modalPhoto.exposure ? ` | ${modalPhoto.exposure}` : ''}
					{modalPhoto.iso ? ` | ISO ${modalPhoto.iso}` : ''}
				</div>
			</div>

			<!-- Filmstrip pinned to bottom of modal content -->
			{#if currentSection && currentSection.photos.length > 1}
				<div
					class="flex w-full items-center justify-center gap-2 overflow-x-auto bg-black/70 px-4 py-2 dark:bg-black/80"
					style="z-index:20;"
				>
					{#each currentSection.photos as thumb, idx}
						<button
							type="button"
							class="mx-1 cursor-pointer rounded border-2 transition-all"
							style="border-color: {idx === modalIndex
								? 'var(--color-accent)'
								: '#444'}; outline: none;"
							on:click={(e) => {
								e.preventDefault();
								if (!currentSection) return;
								modalIndex = idx;
								modalPhoto = currentSection.photos[idx];
								const params = new URLSearchParams(page.url.search);
								params.set('photo', idx.toString());
								goto(`${window.location.pathname}?${params.toString()}`, { replaceState: true });
								requestAnimationFrame(() => modalContainer && modalContainer.focus());
							}}
							tabindex="-1"
							aria-label={`Go to photo ${idx + 1}`}
						>
							<img
								src={thumb.src}
								alt={thumb.title}
								class="h-12 w-auto rounded object-cover"
								style="opacity: {idx === modalIndex ? 1 : 0.6}; border-radius: 4px;"
							/>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}
