<script lang="ts">
	import ExifReader from 'exifreader';
	import { onMount } from 'svelte';

	const images = ['/photos/photo1.jpeg', '/photos/photo2.jpeg', '/photos/photo3.jpeg'];

	let exifData: Record<string, any> = {};

	onMount(async () => {
		for (const src of images) {
			try {
				const response = await fetch(src);
				const arrayBuffer = await response.arrayBuffer();
				const tags = ExifReader.load(arrayBuffer, { expanded: true });
				console.log(tags);
				// Assign a new object to trigger reactivity
				exifData = { ...exifData, [src]: tags };
			} catch (e) {
				exifData = { ...exifData, [src]: {} };
			}
		}
	});
</script>

<div class="m-auto mb-12 w-11/12 text-center">
	<h1 class="mb-4 font-sans text-3xl font-bold">Photo Gallery</h1>
</div>
<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
	{#each images as src}
		<div class="border p-2">
			<img {src} alt="Photo" class="h-auto w-full" />
			{#if exifData[src]}
				<ul class="mt-2 text-xs">
					{#if exifData[src]?.exif?.ISOSpeedRatings}
						<li>
							ISO: {exifData[src].exif.ISOSpeedRatings.description ??
								exifData[src].exif.ISOSpeedRatings.value}
						</li>
					{/if}
					{#if exifData[src]?.exif?.FNumber}
						<li>
							Aperture: {exifData[src].exif.FNumber.description ?? exifData[src].exif.FNumber.value}
						</li>
					{/if}
					{#if exifData[src]?.exif?.FocalLength}
						<li>
							Focal Length: {exifData[src].exif.FocalLength.description ??
								exifData[src].exif.FocalLength.value}
						</li>
					{/if}
					{#if exifData[src]?.exif?.ExposureTime}
						<li>
							Shutter Speed: {exifData[src].exif.ExposureTime.description ??
								exifData[src].exif.ExposureTime.value}
						</li>
					{/if}
					{#if exifData[src]?.exif?.DateTimeOriginal}
						<li>
							Date: {exifData[src].exif.DateTimeOriginal.description ??
								exifData[src].exif.DateTimeOriginal.value}
						</li>
					{/if}
					{#if exifData[src]?.exif?.LensModel}
						<li>
							Lens: {exifData[src].exif.LensModel.description ?? exifData[src].exif.LensModel.value}
						</li>
					{/if}
					{#if exifData[src]?.exif?.Model}
						<li>
							Camera: {exifData[src].exif.Model.description ?? exifData[src].exif.Model.value}
						</li>
					{/if}
				</ul>
			{:else}
				<p class="mt-2 text-xs text-gray-400">Loading EXIF...</p>
			{/if}
		</div>
	{/each}
</div>
