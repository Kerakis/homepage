<svelte:head>
	<title>Kerakis // Birding Guide</title>
</svelte:head>

<header class="mb-6 text-sm text-black dark:text-white" aria-label="Breadcrumb">
	<span class="font-bold">Birding Guide</span>
	<span class="text-accent mx-2">—</span>
	<span>
		A guide to birding in my local area, including top spots, seasonal highlights, and tips for
		finding our feathered friends.
	</span>
</header>

<div class="m-auto mt-8 w-11/12 space-y-12">
	<!-- Introduction Section -->
	<section class="space-y-4">
		<h2 class="text-accent text-3xl font-bold">Welcome to Local Birding</h2>
		<div class="space-y-3 text-lg leading-relaxed">
			<p>
				<!-- Introduction content will go here -->
			</p>
		</div>
	</section>

	<!-- Top Birding Locations -->
	<section class="space-y-6">
		<h2 class="text-accent text-3xl font-bold">Top Birding Locations</h2>
		<div class="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
			<!-- Location cards will go here -->
			<div
				class="hover:border-accent min-h-32 border p-6 transition-colors duration-200 ease-in-out"
			>
				<h3 class="mb-3 text-2xl font-bold">Location Name</h3>
				<div class="space-y-2 text-base">
					<p><span class="font-semibold">Best For:</span> [Species/habitat type]</p>
					<p><span class="font-semibold">Best Season:</span> [Season info]</p>
					<p class="mt-3">[Location description]</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Seasonal Highlights -->
	<section class="space-y-6">
		<h2 class="text-accent text-3xl font-bold">Seasonal Highlights</h2>
		<div class="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
			<!-- Season cards -->
			{#each ['Spring', 'Summer', 'Fall', 'Winter'] as season}
				<div
					class="hover:border-accent border p-6 transition-colors duration-200 ease-in-out"
				>
					<h3 class="mb-3 text-xl font-bold">{season}</h3>
					<ul class="space-y-1 text-base">
						<!-- Seasonal species list will go here -->
						<li>• [Species]</li>
					</ul>
				</div>
			{/each}
		</div>
	</section>

	<!-- Target Species -->
	<section class="space-y-6">
		<h2 class="text-accent text-3xl font-bold">Target Species</h2>
		<div class="space-y-4">
			<!-- Species entries will go here -->
			<div
				class="hover:border-accent border p-6 transition-colors duration-200 ease-in-out"
			>
				<h3 class="mb-2 text-xl font-bold">[Species Name]</h3>
				<p class="text-base">
					<span class="font-semibold">Where to Find:</span> [Location info]
				</p>
				<p class="text-base">
					<span class="font-semibold">When to Look:</span> [Timing info]
				</p>
				<p class="mt-2 text-base">[Additional notes]</p>
			</div>
		</div>
	</section>

	<!-- Tips and Resources -->
	<section class="space-y-6">
		<h2 class="text-accent text-3xl font-bold">Tips & Resources</h2>
		<div class="space-y-3 text-lg leading-relaxed">
			<ul class="list-inside list-disc space-y-2">
				<!-- Tips list will go here -->
				<li>[Tip or resource]</li>
			</ul>
		</div>
	</section>
</div>
