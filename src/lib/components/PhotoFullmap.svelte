<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { darkMode } from '$lib/stores/darkMode';
	import type { Photo } from '$lib/types/photoTypes';
	import { getMarkerHtml, getPhotoPopupHtml } from '$lib/utils/photoUtils';
	import { fly } from 'svelte/transition';
	import { goto } from '$app/navigation';

	export let allPhotos: Photo[] = [];
	export let currentPhoto: Photo;
	export let targetMapViewFromUrl: { lat: number; lon: number; zoom: number } | null = null;
	export let onClose: (() => void) | undefined;
	export let onMapViewChange: ((lat: number, lon: number, zoom: number) => void) | undefined;

	let fullmapContainer: HTMLDivElement | null = null;
	let fullmap: any = null;
	let L: any = null;
	let leafletLoaded = false;
	let allPhotoMarkers: any[] = [];

	onMount(async () => {
		if (!currentPhoto?.gps) return;
		await import('leaflet/dist/leaflet.css');
		const leafletModule = await import('leaflet');
		L = leafletModule.default || leafletModule;
		await import('leaflet.markercluster/dist/MarkerCluster.css');
		await import('leaflet.markercluster/dist/MarkerCluster.Default.css');
		await import('leaflet.markercluster');
		leafletLoaded = true;
		const isDark = get(darkMode);

		if (fullmapContainer && L) {
			const initialCenter = targetMapViewFromUrl
				? [targetMapViewFromUrl.lat, targetMapViewFromUrl.lon]
				: currentPhoto.gps
					? [currentPhoto.gps.lat, currentPhoto.gps.lon]
					: [0, 0];
			const initialZoom = targetMapViewFromUrl ? targetMapViewFromUrl.zoom : 16;

			fullmap = L.map(fullmapContainer, {
				center: initialCenter,
				zoom: initialZoom,
				zoomControl: false,
				attributionControl: false,
				scrollWheelZoom: true,
				dragging: true,
				doubleClickZoom: true,
				boxZoom: true,
				keyboard: true
			});

			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				className: get(darkMode) ? 'map-tiles dark' : 'map-tiles'
			}).addTo(fullmap);
			L.control.zoom({ position: 'topleft' }).addTo(fullmap);

			allPhotoMarkers.forEach((m: any) => m.remove());
			allPhotoMarkers = [];
			const markerCluster = L.markerClusterGroup({ spiderfyOnMaxZoom: true });

			allPhotos.forEach((p) => {
				if (!p.gps) return;
				const isCurrent = currentPhoto?.src === p.src;
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
				let popupHtml = getPhotoPopupHtml(p, isCurrent, true);
				marker.bindPopup(popupHtml, {
					maxWidth: 320,
					minWidth: 200,
					className: isDark ? 'leaflet-popup-dark' : 'leaflet-popup-light'
				});
				markerCluster.addLayer(marker);
			});
			markerCluster.addTo(fullmap);

			fullmap.whenReady(() => {
				fullmap.invalidateSize();
			});
			fullmap.on('moveend zoomend', () => {
				const center = fullmap.getCenter();
				const zoom = fullmap.getZoom();
				onMapViewChange?.(center.lat, center.lng, zoom);
			});
			fullmap.on('popupopen', (e: any) => {
				const popupEl = e.popup.getElement();
				if (!popupEl) return;
				const viewBtn = popupEl.querySelector('button[data-photo-src]');
				if (viewBtn) {
					viewBtn.onclick = async (evt: MouseEvent) => {
						evt.preventDefault();
						const src = viewBtn.getAttribute('data-photo-src');
						const section = viewBtn.getAttribute('data-photo-section');
						const filename = viewBtn.getAttribute('data-photo-filename');
						if (!src || !section || !filename) return;

						// Preload the image
						const img = new window.Image();
						img.src = src;
						await new Promise((resolve, reject) => {
							img.onload = resolve;
							img.onerror = reject;
						});

						const params = new URLSearchParams(window.location.search);
						params.set('photo', filename);
						params.set('path', section);
						params.delete('fullmap');
						params.delete('mapview');
						const url = `${window.location.pathname}?${params.toString()}`;

						await goto(url, {
							replaceState: false,
							noScroll: true,
							keepFocus: true
						});
						onClose?.();
					};
				}
			});
		}
	});

	onDestroy(() => {
		if (fullmap) {
			fullmap.remove();
			fullmap = null;
		}
	});
</script>

<div
	class="fixed inset-0 z-60 flex items-center justify-center bg-black/80"
	style="backdrop-filter: blur(2px);"
	in:fly={{ y: 40, duration: 250 }}
	out:fly={{ y: 40, duration: 250 }}
>
	<button
		type="button"
		class="fixed top-4 right-4 z-70 rounded-full bg-black/40 p-2 text-white shadow-lg transition hover:bg-gray-700 sm:p-3"
		title="Close map (Esc or M)"
		on:click={onClose}
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
		class="z-65 h-screen w-screen rounded shadow-lg sm:h-[80vh] sm:w-[80vw]"
		style="background: #222; box-shadow: 0 0 32px #000a;"
	>
		{#if !leafletLoaded}
			<div class="flex h-full w-full items-center justify-center text-gray-300">Loading map...</div>
		{/if}
	</div>
</div>
