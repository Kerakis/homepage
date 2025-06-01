<script lang="ts">
	import { onDestroy } from 'svelte';
	import { ImageViewer } from 'svelte-image-viewer';
	import { fade, scale, fly } from 'svelte/transition';
	import L from 'leaflet';
	import 'leaflet/dist/leaflet.css';
	import { darkMode } from '$lib/stores/darkMode';
	import { get } from 'svelte/store';

	export let onClose: (() => void) | undefined;
	export let onChange: ((index: number) => void) | undefined;
	export let open: boolean;
	export let photos: any[] = [];
	export let index: number = 0;
	export let section: any = null;

	let modalContainer: HTMLDivElement | null = null;
	let modalIndex = index;
	let zoomed = false;
	let touchStartX: number | null = null;
	let imageLoaded = false;
	let mapContainer: HTMLDivElement | null = null;
	let map: L.Map | null = null;
	let minimapContainer: HTMLDivElement | null = null;
	let fullmapContainer: HTMLDivElement | null = null;
	let minimap: L.Map | null = null;
	let fullmap: L.Map | null = null;

	let allPhotoMarkers: L.Marker[] = []; // <-- Add this line

	let fullMap = false;
	let minimapWidth = 192,
		minimapHeight = 128; // default (w-48 h-32)
	$: {
		// Responsive sizing for minimap
		if (window?.innerWidth > 900) {
			minimapWidth = 320; // w-80
			minimapHeight = 200; // h-50
		} else {
			minimapWidth = 192;
			minimapHeight = 128;
		}
	}

	$: modalPhoto = photos[modalIndex];

	function closeModal() {
		onClose?.();
	}
	function showPrev() {
		modalIndex = (modalIndex - 1 + photos.length) % photos.length;
		onChange?.(modalIndex);
	}
	function showNext() {
		modalIndex = (modalIndex + 1) % photos.length;
		onChange?.(modalIndex);
	}
	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
	}
	function handleTouchEnd(e: TouchEvent) {
		if (zoomed) return;
		if (touchStartX === null) return;
		const touchEndX = e.changedTouches[0].clientX;
		const dx = touchEndX - touchStartX;
		if (Math.abs(dx) > 50) {
			if (dx > 0) showPrev();
			else showNext();
		}
		touchStartX = null;
	}

	function handleModalKeydown(e: KeyboardEvent) {
		// Prevent arrow navigation when full map is open
		if (fullMap) {
			if (e.key === 'Escape') {
				fullMap = false;
				setTimeout(() => modalContainer && modalContainer.focus(), 0);
			}
			return;
		}
		if (!zoomed) {
			if (e.key === 'ArrowLeft') showPrev();
			if (e.key === 'ArrowRight') showNext();
		}
		if (e.key === 'Escape') {
			closeModal();
		}
		setTimeout(() => modalContainer && modalContainer.focus(), 0);
	}

	// Prevent background scroll when modal is open
	$: {
		if (open) document.body.style.overflow = 'hidden';
		else document.body.style.overflow = '';
	}
	onDestroy(() => {
		document.body.style.overflow = '';
	});

	// Focus modal for keyboard navigation
	$: if (open && modalContainer) {
		setTimeout(() => modalContainer && modalContainer.focus(), 0);
	}
	$: if (fullMap && modalContainer) {
		setTimeout(() => modalContainer && modalContainer.focus(), 0);
	}

	// Map logic
	$: if (open && modalPhoto?.gps && minimapContainer && !fullMap) {
		// Clean up previous minimap
		if (minimap) {
			minimap.remove();
			minimap = null;
		}
		minimap = L.map(minimapContainer, {
			center: [modalPhoto.gps.lat, modalPhoto.gps.lon],
			zoom: 12,
			zoomControl: false,
			attributionControl: false,
			scrollWheelZoom: false,
			dragging: false,
			doubleClickZoom: false,
			boxZoom: false,
			keyboard: false
		});
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 19,
			className: 'map-tiles'
		}).addTo(minimap);
		L.marker([modalPhoto.gps.lat, modalPhoto.gps.lon]).addTo(minimap);
	}

	$: if (fullMap && modalPhoto?.gps && fullmapContainer && typeof window !== 'undefined') {
		// Clean up previous fullmap
		if (fullmap) {
			fullmap.remove();
			fullmap = null;
		}
		const isDark = get(darkMode);

		fullmap = L.map(fullmapContainer, {
			center: [modalPhoto.gps.lat, modalPhoto.gps.lon],
			zoom: 16,
			zoomControl: false, // We'll add our own
			attributionControl: false, // We'll add our own
			scrollWheelZoom: true,
			dragging: true,
			doubleClickZoom: true,
			boxZoom: true,
			keyboard: true
		});
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 19,
			className: isDark ? 'map-tiles dark' : 'map-tiles'
		}).addTo(fullmap);

		// Custom zoom controls (styled, top left)
		L.control.zoom({ position: 'topleft' }).addTo(fullmap);

		// Remove previous markers
		allPhotoMarkers.forEach((m: L.Marker) => m.remove());
		allPhotoMarkers = [];

		// Add all photo markers (guard for gps)
		if (photos && Array.isArray(photos)) {
			photos.forEach((photo) => {
				if (!photo.gps || photo.gps.lat == null || photo.gps.lon == null) return;
				const isCurrent = photo === modalPhoto;
				const marker = L.marker([photo.gps.lat, photo.gps.lon], {
					icon: L.icon({
						iconUrl: isCurrent
							? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png'
							: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
						iconSize: [25, 41],
						iconAnchor: [12, 41],
						popupAnchor: [1, -34],
						shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
						shadowSize: [41, 41]
					})
				}).addTo(fullmap!);
				allPhotoMarkers.push(marker);

				// Only link if not current photo and section/filename exist
				let popupHtml = `
  <div class="flex flex-col items-center text-center max-w-xs">
    <img src="${photo.src}" alt="${photo.title}" class="mb-2 rounded max-w-full" style="width:140px;" />
    <strong class="text-lg font-bold mb-1">${photo.title}</strong>
`;
				if (!isCurrent && photo.section && photo.filename) {
					popupHtml += `<a href="/photos?path=${encodeURIComponent(photo.section)}&modal=1&photo=${encodeURIComponent(photo.filename)}" class="mt-2 inline-block rounded bg-red-600 px-4 py-2 font-bold text-white no-underline transition hover:bg-red-700">View</a>`;
				}
				popupHtml += `</div>`;
				marker.bindPopup(popupHtml, {
					maxWidth: 320,
					minWidth: 200,
					className: isDark ? 'custom-popup dark' : 'custom-popup'
				});
				marker.bindPopup(popupHtml, { maxWidth: 260, minWidth: 180, className: 'custom-popup' });
			});
		}
	}

	// Sync modalIndex with parent prop
	$: if (index !== undefined && index !== modalIndex) {
		modalIndex = index;
	}
</script>

{#if open && modalPhoto}
	<div
		bind:this={modalContainer}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
		role="dialog"
		aria-modal="true"
		tabindex="0"
		transition:fade={{ duration: 250 }}
		on:keydown={handleModalKeydown}
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
				{#if section}
					<div class="flex items-center rounded-full bg-black/60 px-4 py-2 text-xs text-white">
						<span>{modalIndex + 1} / {section.photos.length}</span>
					</div>
				{/if}
				<div class="flex items-center gap-2">
					<button
						class="flex items-center justify-center rounded-full bg-black/60 p-3 text-white transition hover:bg-gray-700"
						on:click={() => {
							zoomed = !zoomed;
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
							>
								<circle cx="11" cy="11" r="7" stroke-width="2" />
								<path stroke-width="2" d="M21 21l-4.35-4.35" />
								<path stroke-width="2" d="M8 11h6" />
							</svg>
						{:else}
							<!-- Magnifier plus SVG -->
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-6 w-6"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<circle cx="11" cy="11" r="7" stroke-width="2" />
								<path stroke-width="2" d="M21 21l-4.35-4.35" />
								<path stroke-width="2" d="M11 8v6M8 11h6" />
							</svg>
						{/if}
					</button>
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
						>
							<path stroke-linecap="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
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
					if (e.target !== e.currentTarget) return;
					if (zoomed) return;
					if (e.key === 'Enter' || e.key === ' ') {
						showNext();
						requestAnimationFrame(() => modalContainer && modalContainer.focus());
						e.preventDefault();
					}
				}}
				on:touchstart={handleTouchStart}
				on:touchend={handleTouchEnd}
			>
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
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 19l-7-7 7-7"
							/>
						</svg>
					</button>
				{/if}

				{#if zoomed}
					<ImageViewer src={modalPhoto.src} alt={modalPhoto.title} />
				{:else}
					<img
						src={modalPhoto.src}
						alt={modalPhoto.title}
						class="max-h-full max-w-full object-contain transition-opacity duration-300 select-none"
						draggable="false"
						tabindex="-1"
						on:load={() => (imageLoaded = true)}
						style="opacity: {imageLoaded ? 1 : 0}; transition: opacity 0.3s;"
					/>
				{/if}

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
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</button>
				{/if}
			</div>

			<!-- EXIF/Title block -->
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

			<!-- Map -->
			{#if modalPhoto?.gps}
				<div class="mt-2 flex justify-end">
					{#if !fullMap}
						<button
							type="button"
							class="cursor-pointer rounded border-0 bg-transparent p-0 shadow"
							title="Expand map"
							on:click={() => {
								fullMap = true;
								setTimeout(() => modalContainer && modalContainer.focus(), 0);
							}}
							aria-label="Expand map"
							style="overflow:hidden;"
						>
							<div
								bind:this={minimapContainer}
								class="rounded"
								style="pointer-events: none; width: {minimapWidth * 1.8}px; height: {minimapHeight *
									1.5}px; transition: width 0.3s, height 0.3s;"
								in:scale={{ duration: 200 }}
								out:scale={{ duration: 200 }}
							></div>
						</button>
					{:else}
						<div
							class="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
							style="backdrop-filter: blur(2px);"
							in:fly={{ y: 40, duration: 250 }}
							out:fly={{ y: 40, duration: 250 }}
						>
							<!-- X button always above map -->
							<button
								type="button"
								class="fixed top-4 right-4 z-[200] rounded-full bg-black/40 p-2 text-white shadow-lg transition hover:bg-gray-700 sm:p-3"
								title="Close map"
								on:click={() => {
									fullMap = false;
									setTimeout(() => modalContainer && modalContainer.focus(), 0);
								}}
								aria-label="Close map"
								style="transition: background 0.2s;"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-7 w-7"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path stroke-linecap="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
							<div
								bind:this={fullmapContainer}
								class="z-[100] rounded shadow-lg"
								style="background: #222; box-shadow: 0 0 32px #000a; width: 80vw; height: 80vh;"
								class:!w-screen={window.innerWidth < 640}
								class:!h-screen={window.innerWidth < 640}
							></div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Filmstrip -->
			{#if section && section.photos.length > 1}
				<div
					class="flex w-full items-center justify-center gap-2 overflow-x-auto bg-black/70 px-4 py-2 dark:bg-black/80"
					style="z-index:20;"
				>
					{#each section.photos as thumb, idx}
						<button
							type="button"
							class="mx-1 cursor-pointer rounded border-2 transition-all"
							style="border-color: {idx === modalIndex
								? 'var(--color-accent)'
								: '#444'}; outline: none;"
							on:click={(e) => {
								e.preventDefault();
								modalIndex = idx;
								onChange?.(modalIndex);
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
