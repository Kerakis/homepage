<script lang="ts">
	import { onDestroy } from 'svelte';
	import { ImageViewer } from 'svelte-image-viewer';
	import { fade, scale, fly } from 'svelte/transition';
	import { darkMode } from '$lib/stores/darkMode';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	export let allPhotos: Photo[] = [];

	interface Photo {
		gps?: { lat: number; lon: number } | null;
		subject?: string;
		section?: string;
		filename?: string;
		src?: string;
		title?: string;
		date?: string; // Added for EXIF block consistency
		camera?: string; // Added for EXIF block consistency
		lens?: string; // Added for EXIF block consistency
		focalLength?: string; // Added for EXIF block consistency
		aperture?: string; // Added for EXIF block consistency
		exposure?: string; // Added for EXIF block consistency
		iso?: number; // Added for EXIF block consistency
	}

	export let onClose: (() => void) | undefined;
	export let onChange: ((index: number) => void) | undefined;
	export let open: boolean;
	export let photos: Photo[] = []; // Changed from any[]
	export let index: number = 0;
	export let section: { photos: Photo[]; name?: string } | null = null; // Typed section

	let modalContainer: HTMLDivElement | null = null;
	let modalIndex = index;
	let zoomed = false;
	let touchStartX: number | null = null;
	let imageLoaded = false;
	let minimapContainer: HTMLDivElement | null = null;
	let fullmapContainer: HTMLDivElement | null = null;
	let minimap: any = null;
	let fullmap: any = null; // This will be the Leaflet map instance for the full map

	let allPhotoMarkers: any[] = [];
	let fullMap = false; // Local state for full map visibility
	let minimapWidth = 192,
		minimapHeight = 128;

	// Variable to store map state read from URL to initialize the map
	let targetMapViewFromUrl: { lat: number; lon: number; zoom: number } | null = null;

	const mushroomSVG = `
<svg width="32" height="32" viewBox="0 0 64 64" fill="none">
  <ellipse cx="32" cy="32" rx="28" ry="16" fill="#22304a"/>
  <ellipse cx="32" cy="32" rx="24" ry="12" fill="#fff" fill-opacity="0.1"/>
  <ellipse cx="22" cy="38" rx="4" ry="4" fill="#fff" fill-opacity="0.8"/>
  <ellipse cx="42" cy="36" rx="5" ry="5" fill="#fff" fill-opacity="0.8"/>
  <ellipse cx="32" cy="24" rx="28" ry="16" fill="#22304a"/>
  <ellipse cx="32" cy="24" rx="24" ry="12" fill="#fff" fill-opacity="0.1"/>
  <ellipse cx="22" cy="30" rx="4" ry="4" fill="#fff" fill-opacity="0.8"/>
  <ellipse cx="42" cy="28" rx="5" ry="5" fill="#fff" fill-opacity="0.8"/>
  <rect x="24" y="32" width="16" height="18" rx="6" fill="#22304a"/>
</svg>
`;

	function getIconClassForPhoto(photo: Photo) {
		if (photo.subject === 'bugs') return 'fa-bug';
		if (photo.subject === 'spiders') return 'fa-spider';
		if (photo.subject === 'birds') return 'fa-crow';
		if (photo.subject === 'plants' || photo.subject === 'flowers') return 'fa-seedling';
		if (photo.subject === 'mammals') return 'fa-otter';
		if (photo.subject === 'reptiles') return 'fa-dragon';
		if (photo.subject === 'amphibians') return 'fa-frog';
		if (photo.subject === 'fish') return 'fa-fish';
		if (photo.subject === 'landscape') return 'fa-mountain';
		if (photo.subject === 'architecture') return 'fa-building';
		if (photo.subject === 'people') return 'fa-user';
		if (photo.subject === 'vehicles') return 'fa-car';
		if (photo.subject === 'food') return 'fa-utensils';
		if (photo.subject === 'art') return 'fa-palette';
		if (photo.subject === 'dogs') return 'fa-dog';
		if (photo.subject === 'cats') return 'fa-cat';
		if (photo.subject === 'night') return 'fa-moon';
		return 'fa-image'; // default
	}

	function getMarkerHtml(photo: Photo, isCurrent: boolean) {
		if (photo.subject === 'fungi' || photo.subject === 'mushrooms') {
			return mushroomSVG;
		}
		const iconClass = getIconClassForPhoto(photo);
		const color = isCurrent ? '#e53e3e' : get(darkMode) ? '#ccc' : '#222';
		return `<i class="fa-solid ${iconClass}" style="font-size:2rem;color:${color};text-shadow:0 1px 3px rgba(0,0,0,0.4)"></i>`;
	}

	$: modalPhoto = photos[modalIndex];

	$: if (index !== undefined && index !== modalIndex) {
		modalIndex = index;
		imageLoaded = false;
	}

	function updateMapUrlParams(mapInstance: any | null) {
		if (!browser || !page.url) return;
		const newParams = new URLSearchParams(page.url.search);
		let changed = false;

		if (fullMap && mapInstance) {
			if (newParams.get('fullmap') !== '1') {
				newParams.set('fullmap', '1');
				changed = true;
			}
			const center = mapInstance.getCenter();
			const zoom = mapInstance.getZoom();
			const zoomValue = typeof zoom === 'number' ? zoom.toFixed(1) : '16.0';
			const mapViewValue = `${center.lat.toFixed(5)},${center.lng.toFixed(5)},${zoomValue}`;

			if (newParams.get('mapview') !== mapViewValue) {
				newParams.set('mapview', mapViewValue);
				changed = true;
			}
		} else {
			if (newParams.has('fullmap')) {
				newParams.delete('fullmap');
				changed = true;
			}
			if (newParams.has('mapview')) {
				newParams.delete('mapview');
				changed = true;
			}
		}

		if (changed) {
			goto(`${page.url.pathname}?${newParams.toString()}`, {
				replaceState: true,
				noScroll: true,
				keepFocus: true
			});
		}
	}

	$: if (browser && open && page.url) {
		const params = page.url.searchParams;
		const urlWantsFullMap = params.get('fullmap') === '1';
		const previousFullMapState = fullMap;

		if (urlWantsFullMap && modalPhoto?.gps) {
			if (!fullMap) {
				fullMap = true;
			}

			const mapViewStr = params.get('mapview');
			if (mapViewStr) {
				const parts = mapViewStr.split(',');
				if (parts.length === 3) {
					const newTargetView = {
						lat: parseFloat(parts[0]),
						lon: parseFloat(parts[1]),
						zoom: parseFloat(parts[2])
					};
					if (
						!targetMapViewFromUrl ||
						Math.abs(targetMapViewFromUrl.lat - newTargetView.lat) > 0.000001 ||
						Math.abs(targetMapViewFromUrl.lon - newTargetView.lon) > 0.000001 ||
						Math.abs(targetMapViewFromUrl.zoom - newTargetView.zoom) > 0.001
					) {
						targetMapViewFromUrl = newTargetView;
					}
				}
			} else if (targetMapViewFromUrl) {
				targetMapViewFromUrl = null;
			}
		} else {
			if (fullMap) {
				fullMap = false;
			}
			if (targetMapViewFromUrl) {
				targetMapViewFromUrl = null;
			}
		}

		if (fullMap && !previousFullMapState && modalContainer) {
			setTimeout(() => {
				if (modalContainer) modalContainer.focus();
			}, 0);
		}
	}

	function closeModal() {
		if (fullMap) {
			const newParams = new URLSearchParams(page.url.search);
			newParams.delete('fullmap');
			newParams.delete('mapview');
			const currentPathname = page.url.pathname;
			goto(`${currentPathname}?${newParams.toString()}`, {
				replaceState: true,
				noScroll: true,
				keepFocus: true
			});
		}
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
		if (fullMap) {
			if (e.key === 'Escape') {
				const newParams = new URLSearchParams(page.url.search);
				newParams.delete('fullmap');
				newParams.delete('mapview');
				const currentPathname = page.url.pathname;
				goto(`${currentPathname}?${newParams.toString()}`, {
					replaceState: true,
					noScroll: true,
					keepFocus: true
				});
				setTimeout(() => modalContainer?.focus(), 0);
				e.stopPropagation();
				return;
			}
			return;
		}
		if (!zoomed) {
			if (e.key === 'ArrowLeft') showPrev();
			if (e.key === 'ArrowRight') showNext();
		}
		if (e.key === 'Escape') {
			if (zoomed) {
				zoomed = false;
			} else {
				closeModal();
			}
		}
	}

	$: if (browser) document.body.style.overflow = open ? 'hidden' : '';
	onDestroy(() => {
		if (browser) document.body.style.overflow = '';
		if (fullmap) fullmap.remove();
		if (minimap) minimap.remove();
	});

	$: if (open && modalContainer) {
		setTimeout(() => {
			if (modalContainer) {
				modalContainer.focus();
			}
		}, 0);
	}

	let L: any = null;
	let leafletLoaded = false;

	$: if (
		browser &&
		open &&
		modalPhoto?.gps &&
		((minimapContainer && !fullMap) || (fullmapContainer && fullMap)) &&
		!leafletLoaded &&
		!L
	) {
		import('leaflet/dist/leaflet.css');
		import('leaflet.markercluster/dist/MarkerCluster.css');
		import('leaflet.markercluster/dist/MarkerCluster.Default.css');

		import('leaflet')
			.then((leafletModule) => {
				const leafletInstance = leafletModule.default || leafletModule;
				if (!leafletInstance) throw new Error('Leaflet module loaded but instance is undefined.');
				L = leafletInstance;
				if (typeof window !== 'undefined') (window as any).L = L;
				return import('leaflet.markercluster');
			})
			.then(() => {
				if (L?.markerClusterGroup) {
					leafletLoaded = true;
				} else {
					console.error(
						'Leaflet.markercluster did not initialize. L.markerClusterGroup is undefined.'
					);
					L = null;
					leafletLoaded = false;
				}
			})
			.catch((error) => {
				console.error('Failed to load Leaflet modules:', error);
				L = null;
				leafletLoaded = false;
			});
	}

	$: if (leafletLoaded && L && open && modalPhoto?.gps && minimapContainer && !fullMap) {
		if (minimap) minimap.remove();
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
			className: get(darkMode) ? 'map-tiles dark' : 'map-tiles'
		}).addTo(minimap);
		L.marker([modalPhoto.gps.lat, modalPhoto.gps.lon], {
			icon: L.divIcon({
				className: 'fa-marker-icon',
				html: getMarkerHtml(modalPhoto, true),
				iconSize: [32, 32],
				iconAnchor: [16, 32],
				popupAnchor: [0, -32]
			})
		}).addTo(minimap);
	}

	$: if (leafletLoaded && L && modalPhoto?.gps && fullmapContainer) {
		if (fullMap && !fullmap) {
			const isDark = get(darkMode);
			const initialCenter: L.LatLngExpression = targetMapViewFromUrl
				? [targetMapViewFromUrl.lat, targetMapViewFromUrl.lon]
				: modalPhoto.gps
					? [modalPhoto.gps.lat, modalPhoto.gps.lon]
					: [0, 0];
			const initialZoom: number = targetMapViewFromUrl ? targetMapViewFromUrl.zoom : 16;

			let mapOptions: L.MapOptions = {
				center: initialCenter,
				zoom: initialZoom,
				zoomControl: false,
				attributionControl: false,
				scrollWheelZoom: true,
				dragging: true,
				doubleClickZoom: true,
				boxZoom: true,
				keyboard: true
			};

			fullmap = L.map(fullmapContainer, mapOptions);

			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				className: isDark ? 'map-tiles dark' : 'map-tiles'
			}).addTo(fullmap);
			L.control.zoom({ position: 'topleft' }).addTo(fullmap);

			allPhotoMarkers.forEach((m: any) => m.remove());
			allPhotoMarkers = [];
			const markerCluster = L.markerClusterGroup({ spiderfyOnMaxZoom: true });
			const photoList = allPhotos.length ? allPhotos : photos;

			if (photoList?.length) {
				photoList.forEach((photo) => {
					if (!photo.gps) return;
					const isCurrent = modalPhoto?.src === photo.src;
					const marker = L.marker([photo.gps.lat, photo.gps.lon], {
						icon: L.divIcon({
							className: 'fa-marker-icon',
							html: getMarkerHtml(photo, isCurrent),
							iconSize: [32, 32],
							iconAnchor: [16, 32],
							popupAnchor: [0, -32]
						})
					});
					(marker as any).photoSrc = photo.src;
					allPhotoMarkers.push(marker);
					let popupHtml = `<div class="flex flex-col items-center text-center max-w-xs">
						<img src="${photo.src ?? ''}" alt="${photo.title || 'Photo'}" class="mb-2 rounded max-w-full" style="width:140px;" />
						<strong class="text-lg font-bold mb-1">${photo.title || 'Untitled'}</strong>`;
					if (!isCurrent && photo.section && photo.filename) {
						popupHtml += `<a href="/photos?path=${encodeURIComponent(photo.section)}&modal=1&photo=${encodeURIComponent(photo.filename)}"
							class="mt-2 inline-block rounded bg-red-600 px-4 py-2 font-bold text-white no-underline transition hover:bg-red-700"
							style="color: white !important;">View</a>`;
					}
					popupHtml += `</div>`;
					marker.bindPopup(popupHtml, {
						maxWidth: 320,
						minWidth: 200,
						className: isDark ? 'custom-popup dark' : 'custom-popup'
					});
					markerCluster.addLayer(marker);
				});
			}
			markerCluster.addTo(fullmap);

			fullmap.whenReady(() => {
				if (fullmap) {
					updateMapUrlParams(fullmap);
					fullmap.invalidateSize();
				}
			});
			fullmap.on('moveend zoomend', () => {
				if (fullmap) {
					updateMapUrlParams(fullmap);
				}
			});

			if (modalPhoto?.src && modalPhoto.gps) {
				const currentPhotoMarkerInstance = allPhotoMarkers.find(
					(m: any) => m.photoSrc === modalPhoto.src
				);
				if (currentPhotoMarkerInstance) {
					setTimeout(() => {
						if (fullmap && markerCluster?.hasLayer?.(currentPhotoMarkerInstance)) {
							const parentCluster = markerCluster.getVisibleParent(currentPhotoMarkerInstance);
							if (
								parentCluster &&
								parentCluster !== currentPhotoMarkerInstance &&
								typeof parentCluster.spiderfy === 'function'
							) {
								parentCluster.spiderfy();
							}
						}
					}, 150);
				}
			}
		} else if (fullMap && fullmap && targetMapViewFromUrl) {
			const currentCenter = fullmap.getCenter();
			const currentZoom = fullmap.getZoom();
			if (
				Math.abs(currentCenter.lat - targetMapViewFromUrl.lat) > 0.00001 ||
				Math.abs(currentCenter.lng - targetMapViewFromUrl.lon) > 0.00001 ||
				Math.abs(currentZoom - targetMapViewFromUrl.zoom) > 0.01
			) {
				fullmap.setView(
					[targetMapViewFromUrl.lat, targetMapViewFromUrl.lon],
					targetMapViewFromUrl.zoom
				);
			}
		} else if (!fullMap && fullmap) {
			fullmap.remove();
			fullmap = null;
		}
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
		on:click={() => setTimeout(() => modalContainer?.focus(), 0)}
	>
		<button
			type="button"
			aria-label="Close photo modal"
			class="absolute inset-0"
			on:click={closeModal}
			tabindex="-1"
			style="background: transparent; border: none; padding: 0; margin: 0;"
		></button>

		<div
			class="relative z-10 flex h-screen max-h-none w-screen max-w-none flex-col bg-transparent"
			role="presentation"
			on:click|stopPropagation
		>
			<div class="flex w-full items-center justify-between px-6 pt-6 pb-2">
				{#if section && section.photos?.length}
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
					{#if modalPhoto?.gps}
						<button
							type="button"
							class="flex items-center justify-center rounded-full bg-black/60 p-3 text-white transition hover:bg-gray-700"
							title={fullMap ? 'Hide map (M)' : 'Show map (M)'}
							on:click={() => {
								const newFullMapState = !fullMap;
								if (!newFullMapState) {
									const newParams = new URLSearchParams(page.url.search);
									newParams.delete('fullmap');
									newParams.delete('mapview');
									goto(`${page.url.pathname}?${newParams.toString()}`, {
										replaceState: true,
										noScroll: true,
										keepFocus: true
									});
								} else {
									const newParams = new URLSearchParams(page.url.search);
									newParams.set('fullmap', '1');
									goto(`${page.url.pathname}?${newParams.toString()}`, {
										replaceState: true,
										noScroll: true,
										keepFocus: true
									});
								}
								setTimeout(() => modalContainer?.focus(), 0);
							}}
							aria-label={fullMap ? 'Hide map' : 'Show map'}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-6 w-6"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
								/><path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
								/></svg
							>
						</button>
					{/if}
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

			<div
				class="group relative flex flex-1 items-center justify-center select-none"
				style="min-height:0;"
				role="button"
				tabindex="0"
				on:click={(e) => {
					if (e.target instanceof HTMLElement && !e.target.closest('button')) {
						if (!zoomed) {
							const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
							if (e.clientX - bounds.left < bounds.width / 2) showPrev();
							else showNext();
						}
						requestAnimationFrame(() => modalContainer?.focus());
					}
				}}
				on:keydown={(e) => {
					if (e.target !== e.currentTarget || zoomed) return;
					if (e.key === 'Enter' || e.key === ' ') {
						showNext();
						requestAnimationFrame(() => modalContainer?.focus());
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
							requestAnimationFrame(() => modalContainer?.focus());
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

				{#if !imageLoaded && !zoomed}
					<div class="absolute inset-0 flex items-center justify-center">
						<svg
							class="h-12 w-12 animate-spin text-white"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							><circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle><path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path></svg
						>
					</div>
				{/if}
				{#if zoomed}
					<ImageViewer src={modalPhoto.src ?? ''} alt={modalPhoto.title ?? 'Zoomed photo'} />
				{:else}
					<img
						src={modalPhoto.src}
						alt={modalPhoto?.title ?? 'Photo'}
						class="max-h-full max-w-full object-contain select-none {imageLoaded
							? 'opacity-100'
							: 'opacity-0'}"
						draggable="false"
						tabindex="-1"
						on:load={() => (imageLoaded = true)}
						style="transition: opacity 0.3s;"
					/>
				{/if}

				{#if !zoomed}
					<button
						class="absolute top-1/2 right-4 z-20 -translate-y-1/2 rounded-full bg-black/20 p-3 text-white md:flex"
						on:click|stopPropagation={() => {
							showNext();
							requestAnimationFrame(() => modalContainer?.focus());
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

			<div class="w-full bg-black/70 p-4 text-white dark:bg-black/80">
				<div class="text-lg font-bold">{modalPhoto.title}</div>
				{#if modalPhoto.date}<div class="text-sm">{modalPhoto.date}</div>{/if}
				<div class="mt-1 text-xs">
					{#if modalPhoto.camera}{modalPhoto.camera}{/if}
					{#if modalPhoto.lens}{modalPhoto.camera ? ' | ' : ''}{modalPhoto.lens}{/if}
					{#if modalPhoto.focalLength}{modalPhoto.camera || modalPhoto.lens
							? ' | '
							: ''}{modalPhoto.focalLength}{/if}
					{#if modalPhoto.aperture}{modalPhoto.camera || modalPhoto.lens || modalPhoto.focalLength
							? ' | '
							: ''}{modalPhoto.aperture}{/if}
					{#if modalPhoto.exposure}{modalPhoto.camera ||
						modalPhoto.lens ||
						modalPhoto.focalLength ||
						modalPhoto.aperture
							? ' | '
							: ''}{modalPhoto.exposure}{/if}
					{#if modalPhoto.iso}{modalPhoto.camera ||
						modalPhoto.lens ||
						modalPhoto.focalLength ||
						modalPhoto.aperture ||
						modalPhoto.exposure
							? ' | '
							: ''}ISO {modalPhoto.iso}{/if}
				</div>
			</div>

			{#if modalPhoto?.gps}
				<div class="mt-auto flex justify-end border-t border-gray-700 p-1 dark:border-gray-800">
					{#if !fullMap}
						<button
							type="button"
							class="cursor-pointer rounded border-0 bg-transparent p-0 shadow"
							title="Expand map"
							on:click={() => {
								const newParams = new URLSearchParams(page.url.search);
								if (newParams.get('fullmap') !== '1') {
									newParams.set('fullmap', '1');
									goto(`${page.url.pathname}?${newParams.toString()}`, {
										replaceState: true,
										noScroll: true,
										keepFocus: true
									});
								}
								setTimeout(() => modalContainer?.focus(), 0);
							}}
							aria-label="Expand map"
							style="overflow:hidden;"
						>
							<div
								bind:this={minimapContainer}
								class="rounded"
								style="width:{minimapWidth}px; height:{minimapHeight}px; background: #333;"
								in:scale={{ duration: 200 }}
								out:scale={{ duration: 200 }}
							>
								{#if !leafletLoaded && browser}<div
										class="flex h-full w-full items-center justify-center text-xs text-gray-400"
									>
										Loading map...
									</div>{/if}
							</div>
						</button>
					{/if}
				</div>
			{/if}

			{#if section && section.photos?.length > 1}
				<div
					class="flex w-full items-center justify-center gap-2 overflow-x-auto bg-black/70 px-4 py-2 dark:bg-black/80"
					style="z-index:20;"
				>
					{#each section.photos as thumb, idx (thumb.src)}
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
								requestAnimationFrame(() => modalContainer?.focus());
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

		{#if fullMap && modalPhoto?.gps}
			<div
				class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80"
				style="backdrop-filter: blur(2px);"
				in:fly={{ y: 40, duration: 250 }}
				out:fly={{ y: 40, duration: 250 }}
			>
				<button
					type="button"
					class="fixed top-4 right-4 z-[70] rounded-full bg-black/40 p-2 text-white shadow-lg transition hover:bg-gray-700 sm:p-3"
					title="Close map (Esc or M)"
					on:click={() => {
						const newParams = new URLSearchParams(page.url.search);
						newParams.delete('fullmap');
						newParams.delete('mapview');
						goto(`${page.url.pathname}?${newParams.toString()}`, {
							replaceState: true,
							noScroll: true,
							keepFocus: true
						});
						setTimeout(() => modalContainer?.focus(), 0);
					}}
					aria-label="Close map"
					style="transition: background 0.2s;"
				>
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/></svg
					>
				</button>
				<div
					bind:this={fullmapContainer}
					class="z-[65] rounded shadow-lg"
					style="background: #222; box-shadow: 0 0 32px #000a; width: 80vw; height: 80vh;"
					class:!w-screen={typeof window !== 'undefined' && window.innerWidth < 640}
					class:!h-screen={typeof window !== 'undefined' && window.innerWidth < 640}
				>
					{#if !leafletLoaded && browser}<div
							class="flex h-full w-full items-center justify-center text-gray-300"
						>
							Loading map...
						</div>{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}
