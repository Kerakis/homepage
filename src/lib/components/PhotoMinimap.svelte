<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { darkMode } from '$lib/stores/darkMode';
	import type { Photo } from '$lib/types/photoTypes';
	import { getMarkerHtml } from '$lib/utils/photoUtils';
	import { scale } from 'svelte/transition';

	export let photo: Photo;
	export let width: number = 256;
	export let height: number = 160;
	export let onExpand: (() => void) | undefined;

	let minimapContainer: HTMLDivElement | null = null;
	let minimap: any = null;
	let L: any = null;
	let leafletLoaded = false;

	onMount(async () => {
		if (!photo?.gps) return;
		await import('leaflet/dist/leaflet.css');
		const leafletModule = await import('leaflet');
		L = leafletModule.default || leafletModule;
		await import('leaflet.markercluster/dist/MarkerCluster.css');
		await import('leaflet.markercluster/dist/MarkerCluster.Default.css');
		leafletLoaded = true;

		if (minimapContainer && L) {
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
		}
	});

	onDestroy(() => {
		if (minimap) {
			minimap.remove();
			minimap = null;
		}
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
	{#if !leafletLoaded}
		<div class="flex h-full w-full items-center justify-center text-xs text-gray-400">
			Loading map...
		</div>
	{/if}
</div>
