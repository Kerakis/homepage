<script lang="ts">
	import { onMount } from 'svelte';
	// Optionally, initialize the library here if you want custom behavior
	onMount(() => {
		// The library auto-activates on elements with [data-bigger-picture]
		// You can add extra configurations or manual initializations if needed.
	});
</script>

<!-- Optionally, include Bigger Picture CSS/JS in your src/app.html head -->
<!-- 
<link rel="stylesheet" href="https://unpkg.com/bigger-picture/dist/bigger-picture.min.css" />
<script src="https://unpkg.com/bigger-picture/dist/bigger-picture.min.js"></script>
-->

<h1 class="mb-4 text-2xl font-bold">Photo Gallery</h1>
<div class="grid grid-cols-3 gap-4">
	<!-- Placeholder images; each image triggers the lightbox via data attributes -->
	<img
		src="https://cdn.myportfolio.com/13ee5186-249c-4250-9797-c801844a0277/29a05255-3564-4a48-8990-75ee6e291c5b_rw_1920.jpg?h=9a40c847e223de21ea9733c7566572bf"
		data-bigger-picture
		data-caption="Placeholder Image 1"
		class="cursor-pointer"
		alt="Placeholder 1"
	/>
	<img
		src="https://cdn.myportfolio.com/13ee5186-249c-4250-9797-c801844a0277/8055c6ee-01ac-4565-ab3b-42f83c7140c1_rw_1920.jpg?h=c676ba2ccc15d3d0be30506f296709d8"
		data-bigger-picture
		data-caption="Placeholder Image 2"
		class="cursor-pointer"
		alt="Placeholder 2"
	/>
	<img
		src="https://cdn.myportfolio.com/13ee5186-249c-4250-9797-c801844a0277/47bd651d-9c73-41e0-98b8-9febdbaca295_rw_1920.jpg?h=536bf05e3a0dcc2f85cf882f82ae3ba9"
		data-bigger-picture
		data-caption="Placeholder Image 3"
		class="cursor-pointer"
		alt="Placeholder 3"
	/>
</div>
