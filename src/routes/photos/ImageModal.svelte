<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
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
		thumbnailSrc?: string;
		title?: string;
		date?: string;
		camera?: string;
		lens?: string;
		focalLength?: string;
		aperture?: string;
		exposure?: string;
		iso?: number;
	}

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
	let filmstripElement: HTMLDivElement;
	let previousModalPhotoSrc: string | undefined = undefined;
	let allPhotoMarkers: any[] = [];
	let fullMap = false;
	let minimapWidth = 256,
		minimapHeight = 160;
	let showExif = false;
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
		const outlineColor = '#FFF';

		if (photo.subject === 'fungi' || photo.subject === 'mushrooms') {
			const svgOutlineStyle = `filter: drop-shadow(-1px -1px 0 ${outlineColor}) drop-shadow(1px -1px 0 ${outlineColor}) drop-shadow(-1px 1px 0 ${outlineColor}) drop-shadow(1px 1px 0 ${outlineColor});`;
			return `<span style="display: inline-block; line-height: 1; ${svgOutlineStyle}">${mushroomSVG}</span>`;
		}

		const iconClass = getIconClassForPhoto(photo);
		const iconFillColor = isCurrent ? '#e53e3e' : '#222';
		const faOutlineStyle = `text-shadow: -1px -1px 0 ${outlineColor}, 1px -1px 0 ${outlineColor}, -1px 1px 0 ${outlineColor}, 1px 1px 0 ${outlineColor};`;
		return `<i class="fa-solid ${iconClass}" style="font-size:2rem; color:${iconFillColor}; ${faOutlineStyle}"></i>`;
	}

	$: modalPhoto = photos[modalIndex];

	$: if (index !== undefined && index !== modalIndex) {
		modalIndex = index;
		imageLoaded = false;
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
		if (showExif) {
			if (e.key === 'Escape') {
				showExif = false;
				e.stopPropagation(); // Prevent the event from propagating to the main modal
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
			fullmap.remove();
			fullmap = null;
		}
		if (minimap) {
			minimap.remove();
			minimap = null;
		}
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

	// Create or update minimap
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

	// Full map logic
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

			const photoList = allPhotos;

			if (photoList?.length) {
				photoList.forEach((p) => {
					if (!p.gps) return;
					const isCurrent = modalPhoto?.src === p.src;
					const marker = L.marker([p.gps.lat, p.gps.lon], {
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
					let popupHtml = `<div class="flex flex-col items-center text-center max-w-xs">
                        <img src="${p.thumbnailSrc ?? p.src}" alt="${p.title || 'Photo'}" class="mb-2 rounded max-w-full" style="width:140px;" loading="lazy" />
                        <strong class="text-lg font-bold mb-1">${p.title || 'Untitled'}</strong>`;
					if (!isCurrent && p.section && p.filename) {
						popupHtml += `<a href="/photos?path=${encodeURIComponent(p.section)}&modal=1&photo=${encodeURIComponent(p.filename)}"
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

	$: if (
		browser &&
		open &&
		filmstripElement &&
		photos.length > 0 &&
		modalIndex >= 0 &&
		modalIndex < photos.length
	) {
		const activeThumb = filmstripElement.children[modalIndex] as HTMLElement;
		if (activeThumb && typeof activeThumb.scrollIntoView === 'function') {
			// Use scrollIntoView to center the active thumbnail
			activeThumb.scrollIntoView({
				behavior: 'smooth',
				inline: 'center',
				block: 'nearest'
			});
		}
	}

	let hoveredIdx: number | null = null;

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
							on:click={() => (showExif = true)}
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
						on:contextmenu={(e) => e.preventDefault()}
						on:dragstart={(e) => e.preventDefault()}
					>
						<img
							src={modalPhoto.src}
							alt={modalPhoto?.title ?? 'Photo'}
							class="modal-image max-h-[calc(100vh-18rem)] max-w-[calc(100vw-6rem)] object-contain transition-opacity duration-300 select-none md:max-h-[calc(100vh-22rem)] md:max-w-[calc(100vw-10rem)] lg:max-h-[calc(100vh-24rem)] lg:max-w-[calc(100vw-16rem)]"
							draggable="false"
							tabindex="-1"
							on:load={() => (imageLoaded = true)}
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

			<!-- DESKTOP: EXIF + Minimap block -->
			{#if !isMobile}
				<div
					class="flex w-full flex-col items-start justify-between gap-4 bg-black/70 p-4 text-white sm:flex-row sm:items-end dark:bg-black/80"
				>
					<div class="min-w-0 flex-1">
						<div class="text-lg font-bold">{modalPhoto.title}</div>
						{#if modalPhoto.date}<div class="text-sm">{modalPhoto.date}</div>{/if}
						<div class="mt-1 text-xs break-words">
							{#if modalPhoto.camera}{modalPhoto.camera}{/if}
							{#if modalPhoto.lens}{modalPhoto.camera ? ' | ' : ''}{modalPhoto.lens}{/if}
							{#if modalPhoto.focalLength}{modalPhoto.camera || modalPhoto.lens
									? ' | '
									: ''}{modalPhoto.focalLength}{/if}
							{#if modalPhoto.aperture}{modalPhoto.camera ||
								modalPhoto.lens ||
								modalPhoto.focalLength
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
						<div class="mt-4 sm:mt-0 sm:ml-4">
							<button
								type="button"
								class="cursor-pointer rounded border-0 bg-transparent p-0 shadow"
								title="Expand map"
								on:click={() => {
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
									{#if !leafletLoaded && browser && !fullMap}
										<div
											class="flex h-full w-full items-center justify-center text-xs text-gray-400"
										>
											Loading map...
										</div>
									{/if}
								</div>
							</button>
						</div>
					{/if}
				</div>
			{/if}

			<div
				bind:this={filmstripElement}
				class="filmstrip flex w-full items-center justify-center gap-2 overflow-x-auto bg-black/70 px-4 py-2 dark:bg-black/80"
				style="z-index:20; white-space: nowrap; padding-left: 2rem; padding-right: 2rem;"
			>
				{#each section?.photos ?? [] as thumb, idx (thumb.src)}
					<button
						type="button"
						class="mx-1 flex-shrink-0 cursor-pointer rounded border-2 transition-all"
						style="border-color: {idx === modalIndex
							? 'var(--color-accent)'
							: hoveredIdx === idx
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
						id={`filmstrip-thumb-${idx}`}
						on:mouseenter={() => (hoveredIdx = idx)}
						on:mouseleave={() => (hoveredIdx = null)}
					>
						<img
							src={thumb.thumbnailSrc ?? thumb.src}
							alt={thumb.title}
							class="h-12 w-auto rounded object-cover"
							style="opacity: {idx === modalIndex
								? 1
								: 0.6}; border-radius: 4px; border: 2px solid transparent; box-shadow: {idx ===
							modalIndex
								? '0 0 0 2px var(--color-accent)'
								: 'none'}; transition: border-color 0.15s, box-shadow 0.15s;"
							loading="lazy"
						/>
					</button>
				{/each}
			</div>
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

{#if showExif}
	<div
		class="fixed inset-0 z-60 flex items-center justify-center bg-black/80"
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		on:click={() => (showExif = false)}
		on:keydown={(e) => {
			if (e.key === 'Escape') {
				showExif = false;
				e.stopPropagation(); // Prevent the event from propagating to the main modal
			}
		}}
		aria-label="Close EXIF modal"
	>
		<div
			role="button"
			tabindex="0"
			class="relative w-11/12 max-w-md rounded bg-black/90 p-6 text-white shadow-lg"
			on:click|stopPropagation
			aria-label="EXIF Data Modal"
			on:keydown={(e) => {
				if (e.key === 'Escape') {
					showExif = false;
					e.stopPropagation(); // Prevent the event from propagating to the main modal
				}
			}}
		>
			<!-- Close Button -->
			<button
				class="absolute top-2 right-2 rounded-full bg-black/60 p-2 text-white hover:bg-gray-700"
				on:click={() => (showExif = false)}
				aria-label="Close EXIF modal"
				title="Close"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>

			<!-- EXIF Data -->
			<h2 class="mb-4 text-lg font-bold">EXIF Data</h2>
			<ul class="space-y-2 text-sm">
				{#if modalPhoto.camera}<li><strong>Camera:</strong> {modalPhoto.camera}</li>{/if}
				{#if modalPhoto.lens}<li><strong>Lens:</strong> {modalPhoto.lens}</li>{/if}
				{#if modalPhoto.focalLength}<li>
						<strong>Focal Length:</strong>
						{modalPhoto.focalLength}
					</li>{/if}
				{#if modalPhoto.aperture}<li><strong>Aperture:</strong> {modalPhoto.aperture}</li>{/if}
				{#if modalPhoto.exposure}<li><strong>Exposure:</strong> {modalPhoto.exposure}</li>{/if}
				{#if modalPhoto.iso}<li><strong>ISO:</strong> {modalPhoto.iso}</li>{/if}
			</ul>
		</div>
	</div>
{/if}
