<script lang="ts">
	import { onDestroy } from 'svelte';
	import { ImageViewer } from 'svelte-image-viewer';
	import { fade } from 'svelte/transition';
	import L from 'leaflet';
	import 'leaflet/dist/leaflet.css';

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

	// Keep modalIndex in sync with parent
	$: if (index !== modalIndex) {
		modalIndex = index;
	}

	$: if (open && modalPhoto?.gps && mapContainer) {
		// Clean up previous map
		if (map) {
			map.remove();
			map = null;
		}
		map = L.map(mapContainer, {
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
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			className: 'map-tiles'
		}).addTo(map);
		L.marker([modalPhoto.gps.lat, modalPhoto.gps.lon]).addTo(map);
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
					<button
						type="button"
						class="h-32 w-48 cursor-pointer rounded border-0 bg-transparent p-0 shadow"
						title="View all photos on map"
						on:click={() =>
							(window.location.href = `/map?lat=${modalPhoto.gps.lat}&lon=${modalPhoto.gps.lon}`)}
						aria-label="View all photos on map"
					>
						<div
							bind:this={mapContainer}
							class="h-32 w-48 rounded"
							style="pointer-events: none;"
						></div>
					</button>
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
