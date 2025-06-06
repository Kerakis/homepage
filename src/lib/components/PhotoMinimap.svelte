<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { darkMode } from '$lib/stores/darkMode';
	import type { Photo } from '$lib/types/photoTypes';
	import { getMarkerHtml } from '$lib/utils/photoUtils';
	import { scale } from 'svelte/transition';
	import { browser } from '$app/environment';

	export let photo: Photo;
	export let width: number = 256;
	export let height: number = 160;
	export let onExpand: (() => void) | undefined;

	let minimapContainer: HTMLDivElement | null = null;
	let minimap: any = null;
	let L: any = null;
	let leafletLoaded = false;
	let currentMapPhotoSrc: string | undefined = undefined;

	async function initializeLeaflet() {
		if (L || !browser) return;
		try {
			await import('leaflet/dist/leaflet.css');
			const leafletModule = await import('leaflet');
			L = leafletModule.default || leafletModule;
			leafletLoaded = true;
		} catch (error) {
			console.error('Failed to load Leaflet:', error);
			leafletLoaded = false;
		}
	}

	onMount(async () => {
		await initializeLeaflet();
	});

	$: if (browser && L && leafletLoaded && minimapContainer) {
		if (photo?.gps && (!minimap || currentMapPhotoSrc !== photo.src)) {
			if (minimap) {
				minimap.remove();
				minimap = null;
			}

			minimap = L.map(minimapContainer, {
				center: [photo.gps.lat, photo.gps.lon],
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
			L.marker([photo.gps.lat, photo.gps.lon], {
				icon: L.divIcon({
					className: 'fa-marker-icon',
					html: getMarkerHtml(photo, true),
					iconSize: [32, 32],
					iconAnchor: [16, 32],
					popupAnchor: [0, -32]
				})
			}).addTo(minimap);
			currentMapPhotoSrc = photo.src;

			minimap.whenReady(() => {
				setTimeout(() => {
					if (minimap) minimap.invalidateSize();
				}, 50);
			});
		} else if (!photo?.gps && minimap) {
			minimap.remove();
			minimap = null;
			currentMapPhotoSrc = undefined;
		}
	} else if (minimap && (!L || !leafletLoaded || !minimapContainer)) {
		minimap.remove();
		minimap = null;
		currentMapPhotoSrc = undefined;
	}

	onDestroy(() => {
		if (minimap) {
			minimap.remove();
			minimap = null;
		}

		currentMapPhotoSrc = undefined;
	});
</script>

<div
	style="width:{width}px; height:{height}px; background: #333; cursor: pointer;"
	class="rounded"
	bind:this={minimapContainer}
	in:scale={{ duration: 200 }}
	out:scale={{ duration: 200 }}
	onclick={onExpand}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') onExpand?.();
	}}
	role="button"
	tabindex="0"
	aria-label="Expand map"
>
	{#if !photo?.gps}
		<div class="flex h-full w-full items-center justify-center text-xs text-gray-400">
			No GPS data for this photo.
		</div>
	{:else if !leafletLoaded && browser}
		<div class="flex h-full w-full items-center justify-center text-xs text-gray-400">
			Loading map...
		</div>
	{/if}
</div>
