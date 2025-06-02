<script context="module">
	// Disable server-side rendering so browser-specific code runs only on the client.
	export const ssr = false;
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import L from 'leaflet';

	// Import Leaflet’s CSS and marker cluster styles.
	import 'leaflet/dist/leaflet.css';
	import 'leaflet.markercluster/dist/MarkerCluster.css';
	import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
	// Import the marker cluster functionality.
	import 'leaflet.markercluster';

	onMount(() => {
		// The container is guaranteed to exist now because SSR is disabled.
		const map = L.map('map').setView([46.879966, -121.726909], 4);

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
		}).addTo(map);

		const markers = L.markerClusterGroup({ showCoverageOnHover: false });

		// Declare marker coordinates as two-element tuples.
		const markerList: [number, number][] = [
			[46.879966, -121.726909],
			[45.879966, -120.726909],
			[47.879966, -122.726909],
			[46.579966, -121.326909],
			[47.379966, -121.926909],
			[35.639557, -83.73878500000001],
			[35.641057, -83.744125],
			[35.63802, -83.736992],
			[35.641057, -83.744125],

			// wildlife/bugs:
			[35.954502, -84.135117],
			[35.643208, -83.750748],
			// Note: The "Cricket" photo had:
			[35.63992, -83.741248],
			[35.643208, -83.750748],
			[35.950932, -84.167717],

			// wildlife/plants:
			[35.643208, -83.750748]
		];

		markerList.forEach((coords: [number, number]) => {
			const marker = L.marker(coords);
			marker.bindPopup(`Marker at: ${coords}`);
			markers.addLayer(marker);
		});

		map.addLayer(markers);

		return () => {
			map.remove();
		};
	});
</script>

<!-- Always render the map container -->
<div id="map"></div>

<style>
	/* Ensure the map container is visible by defining its dimensions */
	#map {
		height: 100vh;
		width: 100%;
	}
</style>
