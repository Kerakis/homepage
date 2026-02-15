<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import ExifModal from '$lib/components/ExifModal.svelte';
	import Filmstrip from '$lib/components/Filmstrip.svelte';
	import PhotoMinimap from '$lib/components/PhotoMinimap.svelte';
	import PhotoFullmap from '$lib/components/PhotoFullmap.svelte';
	import { ImageViewer } from 'svelte-image-viewer';
	import { fade } from 'svelte/transition';
	import { darkMode } from '$lib/stores/darkMode';
	import { get, writable } from 'svelte/store';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { Photo } from '$lib/types/photoTypes';
	import { getPhotoPopupHtml, getMarkerHtml } from '$lib/utils/photoUtils';
	import { formatMonthYear } from '$lib/utils/photoUtils';

	export let allPhotos: Photo[] = [];

	export let onClose: (() => void) | undefined;
	export let onChange: ((index: number) => void) | undefined;
	export let open: boolean;
	export let photos: Photo[] = [];
	export let index: number = 0;
	export let section: { photos: Photo[]; name?: string } | null = null;

	let modalContainer: HTMLDivElement | null = null;
	let modalIndex = index;
	let zoomed = false;
	let touchStartX: number | null = null;
	let imageLoaded = false;
	let minimapContainer: HTMLDivElement | null = null;
	let fullmapContainer: HTMLDivElement | null = null;
	let minimap: any = null;
	let fullmap: any = null;
	let previousModalPhotoSrc: string | undefined = undefined;
	let allPhotoMarkers: any[] = [];
	let markerCluster: any = null; // Cache the cluster
	let fullMap = false;
	let minimapWidth = 256,
		minimapHeight = 160;
	let showExifStore = writable(false);
	let targetMapViewFromUrl: { lat: number; lon: number; zoom: number } | null = null;
	let mapInitialized = false; // Track initialization state
	let currentMapPhotoSrc: string | undefined = undefined;

	// Add these simple protection functions
	function handleContextMenu(e: MouseEvent) {
		e.preventDefault();
		return false;
	}

	function handleDragStart(e: DragEvent) {
		e.preventDefault();
		return false;
	}

	function handleLongPress(e: TouchEvent) {
		// Prevent long press context menu on mobile
		let longPressTimer = setTimeout(() => {
			e.preventDefault();
		}, 500);

		const target = e.target as HTMLElement;

		const cleanup = () => {
			clearTimeout(longPressTimer);
		};

		target.addEventListener('touchend', cleanup, { once: true });
		target.addEventListener('touchmove', cleanup, { once: true });
		target.addEventListener('touchcancel', cleanup, { once: true });
	}

	$: modalPhoto = photos[modalIndex];

	$: if (index !== undefined && index !== modalIndex) {
		modalIndex = index;
		imageLoaded = false;
		// The Filmstrip component will handle its own scrolling via afterUpdate
	}

	$: if (open && modalPhoto && modalContainer && browser) {
		if (modalPhoto.src !== previousModalPhotoSrc) {
			setTimeout(() => {
				modalContainer?.focus();
			}, 50);
			previousModalPhotoSrc = modalPhoto.src;
		}
	} else if (!open && browser) {
		previousModalPhotoSrc = undefined;
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
		if (get(showExifStore)) {
			if (e.key === 'Escape') {
				showExifStore.set(false);
				e.stopPropagation();
				return;
			}
		}

		if (fullMap) {
			if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') {
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

		if (e.key === 'm' || e.key === 'M') {
			if (modalPhoto?.gps) {
				const newFullMapState = !fullMap;
				const newParams = new URLSearchParams(page.url.search);
				if (!newFullMapState) {
					newParams.delete('fullmap');
					newParams.delete('mapview');
				} else {
					newParams.set('fullmap', '1');
					if (modalPhoto?.filename) newParams.set('photo', modalPhoto.filename);
					if (section?.name) newParams.set('path', section.name);
					else if (modalPhoto?.section) newParams.set('path', modalPhoto.section);
				}
				goto(`${page.url.pathname}?${newParams.toString()}`, {
					replaceState: true,
					noScroll: true,
					keepFocus: true
				});
				setTimeout(() => modalContainer?.focus(), 0);
				e.preventDefault();
			}
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
		if (fullmap) {
			fullmap.off();
			fullmap.remove();
			fullmap = null;
		}
		if (minimap) {
			minimap.off();
			minimap.remove();
			minimap = null;
		}
		if (markerCluster) {
			markerCluster.clearLayers();
			markerCluster = null;
		}
		allPhotoMarkers = [];
		mapInitialized = false;
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

	// Load Leaflet library
	$: if (
		browser &&
		open &&
		modalPhoto?.gps &&
		!leafletLoaded &&
		!L &&
		(minimapContainer || fullmapContainer)
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

	// Debounce map updates
	let mapUpdateTimeout: number | null = null;
	function debounceMapUpdate(fn: () => void, delay = 100) {
		if (mapUpdateTimeout) clearTimeout(mapUpdateTimeout);
		mapUpdateTimeout = setTimeout(fn, delay);
	}

	// Optimize minimap - only recreate when necessary
	$: if (leafletLoaded && L && open && modalPhoto?.gps && minimapContainer && !fullMap) {
		// Only recreate if photo location changed significantly or map doesn't exist
		const needsUpdate =
			!minimap ||
			!currentMapPhotoSrc ||
			currentMapPhotoSrc !== modalPhoto.src ||
			(minimap && Math.abs(minimap.getCenter().lat - modalPhoto.gps.lat) > 0.001);

		if (needsUpdate) {
			if (minimap) {
				minimap.off(); // Remove all event listeners
				minimap.remove();
				minimap = null;
			}

			debounceMapUpdate(() => {
				if (!modalPhoto?.gps || !minimapContainer) return;

				minimap = L.map(minimapContainer, {
					center: [modalPhoto.gps.lat, modalPhoto.gps.lon],
					zoom: 12,
					zoomControl: false,
					attributionControl: false,
					scrollWheelZoom: false,
					dragging: false,
					doubleClickZoom: false,
					boxZoom: false,
					keyboard: false,
					preferCanvas: true, // Use canvas for better performance
					updateWhenIdle: true,
					updateWhenZooming: false
				});

				L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					maxZoom: 19,
					className: get(darkMode) ? 'map-tiles dark' : 'map-tiles',
					updateWhenIdle: true,
					updateWhenZooming: false,
					keepBuffer: 2
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

				currentMapPhotoSrc = modalPhoto.src;

				minimap.whenReady(() => {
					setTimeout(() => {
						if (minimap) minimap.invalidateSize();
					}, 50);
				});
			}, 50);
		}
	}

	// Optimize fullmap - reuse existing map when possible
	$: if (leafletLoaded && L && modalPhoto?.gps && fullmapContainer) {
		if (fullMap && !fullmap) {
			const isDark = get(darkMode);
			const initialCenter: L.LatLngExpression = targetMapViewFromUrl
				? [targetMapViewFromUrl.lat, targetMapViewFromUrl.lon]
				: [modalPhoto.gps.lat, modalPhoto.gps.lon];
			const initialZoom: number = targetMapViewFromUrl ? targetMapViewFromUrl.zoom : 16;

			fullmap = L.map(fullmapContainer, {
				center: initialCenter,
				zoom: initialZoom,
				zoomControl: false,
				attributionControl: false,
				scrollWheelZoom: true,
				dragging: true,
				doubleClickZoom: true,
				boxZoom: true,
				keyboard: true,
				preferCanvas: true, // Use canvas rendering
				updateWhenIdle: true,
				renderer: L.canvas() // Force canvas renderer for better performance
			});

			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				className: isDark ? 'map-tiles dark' : 'map-tiles',
				updateWhenIdle: true,
				updateWhenZooming: false,
				keepBuffer: 2
			}).addTo(fullmap);

			L.control.zoom({ position: 'topleft' }).addTo(fullmap);

			// Initialize markers only once
			if (!mapInitialized) {
				allPhotoMarkers.forEach((m: any) => m.remove());
				allPhotoMarkers = [];

				markerCluster = L.markerClusterGroup({
					spiderfyOnMaxZoom: true,
					showCoverageOnHover: false,
					zoomToBoundsOnClick: true,
					maxClusterRadius: 50
					// Keep animations enabled
				});

				// Filter photos with GPS data upfront
				const photosWithGPS = allPhotos.filter((p) => p.gps);

				photosWithGPS.forEach((p) => {
					const isCurrent = modalPhoto?.src === p.src;
					const marker = L.marker([p.gps!.lat, p.gps!.lon], {
						icon: L.divIcon({
							className: 'fa-marker-icon',
							html: getMarkerHtml(p, isCurrent),
							iconSize: [32, 32],
							iconAnchor: [16, 32],
							popupAnchor: [0, -32]
						})
					});
					(marker as any).photoSrc = p.src;
					allPhotoMarkers.push(marker);

					let popupHtml = getPhotoPopupHtml(p, isCurrent, false);
					marker.bindPopup(popupHtml, {
						maxWidth: 320,
						minWidth: 200,
						className: isDark ? 'leaflet-popup-dark' : 'leaflet-popup-light'
						// Keep autoPan enabled for better UX
					});
					markerCluster.addLayer(marker);
				});

				markerCluster.addTo(fullmap);
				mapInitialized = true;
			} else if (markerCluster) {
				// Just add existing cluster to new map
				markerCluster.addTo(fullmap);
			}

			fullmap.whenReady(() => {
				setTimeout(() => {
					if (fullmap) {
						updateMapUrlParams(fullmap);
						fullmap.invalidateSize();
					}
				}, 100);
			});

			// Debounce map movement events
			let moveTimeout: number | null = null;
			fullmap.on('moveend zoomend', () => {
				if (moveTimeout) clearTimeout(moveTimeout);
				moveTimeout = setTimeout(() => {
					if (fullmap) updateMapUrlParams(fullmap);
				}, 150);
			});

			// Keep the existing spiderfy logic for current photo
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
			// Optimize view updates but keep animations
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
					// Keep default animation settings
				);
			}
		} else if (!fullMap && fullmap) {
			fullmap.off(); // Remove all event listeners
			fullmap.remove();
			fullmap = null;
		}
	}

	function handleFilmstripChange(newIndex: number) {
		modalIndex = newIndex;
		onChange?.(modalIndex);
		requestAnimationFrame(() => modalContainer?.focus());
	}

	let isMobile = false;
	onMount(() => {
		function checkMobile() {
			isMobile = window.innerWidth < 1100;
		}
		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => window.removeEventListener('resize', checkMobile);
	});
</script>

{#if open && modalPhoto}
	<div
		bind:this={modalContainer}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-2 sm:p-6"
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
					{#if isMobile}
						<button
							class="flex items-center justify-center rounded-full bg-black/60 p-3 text-white transition hover:bg-gray-700"
							on:click={() => showExifStore.set(true)}
							aria-label="Show EXIF data"
							title="Show EXIF data"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-6 w-6"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 4v16m8-8H4"
								/>
							</svg>
						</button>
					{/if}
					<button
						class="flex items-center justify-center rounded-full bg-black/60 p-3 text-white transition hover:bg-gray-700"
						on:click={() => {
							zoomed = !zoomed;
						}}
						aria-label={zoomed ? 'Disable zoom/pan' : 'Enable zoom/pan'}
						title={zoomed ? 'Disable zoom/pan' : 'Enable zoom/pan'}
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
								const newParams = new URLSearchParams(page.url.search);
								if (!newFullMapState) {
									newParams.delete('fullmap');
									newParams.delete('mapview');
								} else {
									newParams.set('fullmap', '1');
									// Always set the current photo and path!
									if (modalPhoto?.filename) newParams.set('photo', modalPhoto.filename);
									if (section?.name) newParams.set('path', section.name);
									else if (modalPhoto?.section) newParams.set('path', modalPhoto.section);
								}
								goto(`${page.url.pathname}?${newParams.toString()}`, {
									replaceState: true,
									noScroll: true,
									keepFocus: true
								});
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
						title="Close"
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
				aria-label="Image container"
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
				{#if !zoomed && photos.length > 1}
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
					<div
						role="img"
						aria-label={modalPhoto?.title ?? 'Photo'}
						on:contextmenu={handleContextMenu}
						on:dragstart={handleDragStart}
					>
						<img
							src={modalPhoto.src}
							alt={modalPhoto?.title ?? 'Photo'}
							class="modal-image max-h-[calc(100vh-18rem)] max-w-[calc(100vw-6rem)] object-contain transition-opacity duration-300 select-none md:max-h-[calc(100vh-22rem)] md:max-w-[calc(100vw-10rem)] lg:max-h-[calc(100vh-24rem)] lg:max-w-[calc(100vw-16rem)]"
							draggable="false"
							tabindex="-1"
							on:load={() => (imageLoaded = true)}
							on:contextmenu={handleContextMenu}
							on:dragstart={handleDragStart}
							on:touchstart={handleLongPress}
							loading="lazy"
						/>
					</div>
				{/if}

				{#if !zoomed && photos.length > 1}
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

			<!-- DESKTOP: EXIF + Minimap block section -->
			{#if !isMobile}
				<div
					class="flex w-full flex-col items-start justify-between gap-4 bg-black/70 p-4 text-white sm:flex-row sm:items-start dark:bg-black/80"
				>
					<div
						class="flex min-w-0 flex-1 flex-col justify-between"
						style="min-height: {minimapHeight}px;"
					>
						<!-- Top section: Title and Scientific Name -->
						<div>
							<div class="text-lg font-bold">{modalPhoto.title}</div>
							{#if modalPhoto.scientificName && modalPhoto.taxonRank}
								<div class="mt-0.5 text-sm italic opacity-90">
									{#if modalPhoto.wikipediaUrl}
										<a
											href={modalPhoto.wikipediaUrl}
											target="_blank"
											rel="noopener noreferrer"
											class="nav-underline"
										>
											{#if modalPhoto.taxonRank !== 'species' && modalPhoto.taxonRank !== 'subspecies'}
												{modalPhoto.taxonRank.charAt(0).toUpperCase() +
													modalPhoto.taxonRank.slice(1)}
												{modalPhoto.scientificName}
											{:else}
												{modalPhoto.scientificName}
											{/if}
										</a>
									{:else if modalPhoto.taxonRank !== 'species' && modalPhoto.taxonRank !== 'subspecies'}
										{modalPhoto.taxonRank.charAt(0).toUpperCase() + modalPhoto.taxonRank.slice(1)}
										{modalPhoto.scientificName}
									{:else}
										{modalPhoto.scientificName}
									{/if}
								</div>
							{/if}
						</div>

						<!-- Bottom section: Date and EXIF data -->
						<div class="flex flex-col justify-end">
							{#if modalPhoto.date}
								<div class="mb-2 flex items-center gap-2 text-sm">
									<i class="fa-solid fa-calendar text-accent text-[1.5rem]"></i>
									{formatMonthYear(modalPhoto.date)}
								</div>
							{/if}

							<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
								{#if modalPhoto.camera}
									<span class="flex items-center gap-1">
										<i class="fa-solid fa-camera text-accent text-[1.5rem]"></i>
										<span class="font-semibold">{modalPhoto.camera}</span>
									</span>
								{/if}
								{#if modalPhoto.lens}
									<span class="flex items-center gap-1">
										<svg
											class="text-accent h-7 w-7"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<rect
												x="3"
												y="6"
												width="14"
												height="12"
												rx="1"
												stroke="currentColor"
												fill="none"
											/>
											<rect
												x="17"
												y="6"
												width="2"
												height="12"
												rx="0.5"
												stroke="currentColor"
												fill="none"
											/>
											<rect
												x="19"
												y="6"
												width="2"
												height="12"
												rx="0.5"
												stroke="currentColor"
												fill="none"
											/>
											<rect
												x="2"
												y="9"
												width="1"
												height="6"
												rx="0.5"
												stroke="currentColor"
												fill="none"
											/>
										</svg>
										{modalPhoto.lens}
									</span>
								{/if}
								{#if modalPhoto.focalLength}
									<span class="flex items-center gap-1">
										<svg
											class="text-accent h-6 w-6"
											viewBox="0 0 512 512"
											fill="none"
											stroke="currentColor"
											stroke-width="32"
										>
											<path
												d="M409.313 70.688l56.010-31.803-13.56-23.905-424.608 241.12 431.837 240.956 13.386-23.997-50.714-28.294c32.801-47.379 117.729-201.089-12.351-374.077zM397.548 431.296l-70.231-39.188c31.803-18.050 54.288-71.394 54.288-136.118 0-66.373-23.666-120.688-56.762-137.336l60.363-34.276c124.38 162.616 41.012 306.503 12.342 346.92zM303.385 140.772c23.997 0 50.733 47.315 50.733 115.219s-26.736 115.219-50.733 115.219-50.742-47.315-50.742-115.219 26.746-115.219 50.742-115.219zM242.519 165.4c-10.894 24.482-17.373 55.891-17.373 90.59 0 33.635 6.13 64.129 16.428 88.281l-158.382-88.391 159.327-90.479z"
												stroke="currentColor"
												fill="none"
											/>
										</svg>
										{modalPhoto.focalLength}
									</span>
								{/if}
								{#if modalPhoto.aperture}
									<span class="flex items-center gap-1">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="24"
											height="24"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											class="feather text-accent feather-aperture"
											><circle cx="12" cy="12" r="10"></circle><line
												x1="14.31"
												y1="8"
												x2="20.05"
												y2="17.94"
											></line><line x1="9.69" y1="8" x2="21.17" y2="8"></line><line
												x1="7.38"
												y1="12"
												x2="13.12"
												y2="2.06"
											></line><line x1="9.69" y1="16" x2="3.95" y2="6.06"></line><line
												x1="14.31"
												y1="16"
												x2="2.83"
												y2="16"
											></line><line x1="16.62" y1="12" x2="10.88" y2="21.94"></line></svg
										>
										{modalPhoto.aperture}
									</span>
								{/if}
								{#if modalPhoto.exposure}
									<span class="flex items-center gap-1">
										<i class="fa-solid fa-stopwatch text-accent text-[1.5rem]"></i>
										{modalPhoto.exposure}
									</span>
								{/if}
								{#if modalPhoto.iso}
									<span class="flex items-center gap-1 whitespace-nowrap">
										<svg class="text-accent h-7 w-7" viewBox="0 0 24 24">
											<path
												d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM5.5 7.5h2v-2H9v2h2V9H9v2H7.5V9h-2V7.5zM19 19H5L19 5v14zm-2-2v-1.5h-5V17h5z"
												fill="var(--color-accent)"
											></path>
										</svg>
										ISO {modalPhoto.iso}
									</span>
								{/if}
							</div>
						</div>
					</div>

					<!-- Always reserve space for minimap to prevent layout shift -->
					<div class="shrink-0" style="width: {minimapWidth}px; height: {minimapHeight}px;">
						{#if modalPhoto?.gps}
							<PhotoMinimap
								photo={modalPhoto}
								width={minimapWidth}
								height={minimapHeight}
								onExpand={() => {
									// Open the full map (update URL as before)
									const newParams = new URLSearchParams(page.url.search);
									newParams.set('fullmap', '1');
									if (modalPhoto?.filename) newParams.set('photo', modalPhoto.filename);
									if (section?.name) newParams.set('path', section.name);
									else if (modalPhoto?.section) newParams.set('path', modalPhoto.section);
									newParams.delete('mapview');
									goto(`${page.url.pathname}?${newParams.toString()}`, {
										replaceState: true,
										noScroll: true,
										keepFocus: true
									});
									setTimeout(() => modalContainer?.focus(), 0);
								}}
							/>
						{/if}
					</div>
				</div>
			{/if}

			{#if isMobile && modalPhoto?.title}
				<div class="px-4 pb-2 text-center text-white">
					{#if modalPhoto.scientificName && modalPhoto.wikipediaUrl}
						<a
							href={modalPhoto.wikipediaUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="nav-underline text-white"
						>
							{modalPhoto.title} <span class="italic">({modalPhoto.scientificName})</span>
						</a>
					{:else if modalPhoto.scientificName}
						{modalPhoto.title} <span class="italic">({modalPhoto.scientificName})</span>
					{:else}
						{modalPhoto.title}
					{/if}
				</div>
			{/if}

			<Filmstrip
				photos={section?.photos ?? []}
				currentIndex={modalIndex}
				onChangeIndex={handleFilmstripChange}
			/>
		</div>

		{#if fullMap && modalPhoto?.gps}
			<PhotoFullmap
				{allPhotos}
				currentPhoto={modalPhoto}
				{targetMapViewFromUrl}
				onClose={() => {
					// Close the map (update URL as before)
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
				onMapViewChange={(lat, lon, zoom) => {
					// Optional: update targetMapViewFromUrl or URL params if you want to sync map view
					targetMapViewFromUrl = { lat, lon, zoom };
				}}
			/>
		{/if}

		<ExifModal bind:showExif={showExifStore} {modalPhoto} />
	</div>
{/if}
