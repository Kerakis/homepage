<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { darkMode } from '$lib/stores/darkMode';
	import 'leaflet/dist/leaflet.css';

	let mapContainer: HTMLDivElement | null = null;
	let map: any = null;
	let photos: any[] = [];
	let isDark = false;

	const unsubscribe = darkMode.subscribe((value) => (isDark = value));
	onDestroy(unsubscribe);

	onMount(async () => {
		const res = await fetch('/photos/photos.json');
		const gallery = await res.json();
		photos = gallery
			.flatMap((section: any) =>
				(section.photos ?? []).map((p: any) => ({ ...p, section: section.section }))
			)
			.filter((p: any) => p.gps);

		if (!mapContainer) return;

		const L = (await import('leaflet')).default;
		map = L.map(mapContainer, {
			center: [0, 0],
			zoom: 3
		});
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 19,
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			className: 'map-tiles'
		}).addTo(map);

		setTimeout(() => map.invalidateSize(), 200);

		photos.forEach((photo) => {
			const marker = L.marker([photo.gps.lat, photo.gps.lon]).addTo(map);
			marker.bindPopup(`
                <div style="text-align:center;">
                    <img src="${photo.src}" alt="${photo.title}" style="width:100px;border-radius:4px;" /><br/>
                    <strong>${photo.title}</strong><br/>
                    <a href="/photos?path=${encodeURIComponent(photo.section)}&modal=1&photo=${photo.filename}">View</a>
                </div>
            `);
		});
	});
</script>

<div
	class="h-[80vh] w-full rounded shadow transition-colors duration-300"
	class:bg-zinc-900={isDark}
	class:bg-gray-100={!isDark}
	bind:this={mapContainer}
></div>
