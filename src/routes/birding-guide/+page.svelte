<script lang="ts">
	export let data;
</script>

<svelte:head>
	<title>Kerakis // Birding Guide</title>
</svelte:head>

<header class="mb-6 text-sm text-black dark:text-white" aria-label="Breadcrumb">
	<span class="font-bold">Birding Guide</span>
	<span class="text-accent mx-2">—</span>
	<span>
		A guide to birding in Knox County, including top spots, seasonal highlights, and tips for
		finding our feathered friends.
	</span>
</header>

<div class="m-auto mt-8 w-11/12 space-y-12">
	<!-- Introduction Section -->
	<section class="space-y-4">
		<h2 class="text-accent text-3xl font-bold">Welcome to Birding in Knox County</h2>
		<div class="space-y-3 text-lg leading-relaxed">
			<p>
				Knox County is a fantastic birding destination with diverse habitats and over
				{data?.stats?.totalSpecies || '300'} species recorded. From the Great Smoky Mountains to the Tennessee
				River, there's always something new to discover.
			</p>
		</div>
	</section>

	<!-- Top Birding Locations -->
	<section class="space-y-6">
		<h2 class="text-accent text-3xl font-bold">Top Birding Locations</h2>
		<div class="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
			{#if data?.hotspots && data.hotspots.length > 0}
				{#each data.hotspots as hotspot (hotspot.id)}
					<div
						class="hover:border-accent min-h-32 border p-6 transition-colors duration-200 ease-in-out"
					>
						<h3 class="mb-3 text-2xl font-bold">{hotspot.name}</h3>
						<div class="space-y-2 text-base">
							<p>
								<span class="font-semibold">Species Recorded:</span>
								{hotspot.speciesCount}
							</p>
							<p>
								<span class="font-semibold">Coordinates:</span>
								{hotspot.latitude.toFixed(4)}, {hotspot.longitude.toFixed(4)}
							</p>
							<p class="mt-3 text-sm">
								<a
									href="https://ebird.org/hotspot/{hotspot.id}"
									target="_blank"
									rel="noreferrer"
									class="text-accent hover:underline">View on eBird →</a
								>
							</p>
						</div>
					</div>
				{/each}
			{:else}
				<p class="col-span-full text-base">Loading hotspot data...</p>
			{/if}
		</div>
	</section>

	<!-- Seasonal Highlights -->
	<section class="space-y-6">
		<h2 class="text-accent text-3xl font-bold">Best Hotspots by Season</h2>
		<p class="text-base text-black dark:text-white">
			These hotspots are best for finding seasonal migrants and species you won't see in other times
			of year. Spring and Fall are prime for warblers, while Winter brings waterfowl.
		</p>
		<div class="space-y-8">
			{#each ['spring', 'summer', 'fall', 'winter'] as seasonKey}
				{@const typedSeason = seasonKey as 'spring' | 'summer' | 'fall' | 'winter'}
				{@const seasonData = data?.seasonalHotspots?.[typedSeason] ?? []}
				<div>
					<h3 class="text-accent mb-4 text-2xl font-bold capitalize">{seasonKey}</h3>
					<div class="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
						{#each seasonData as hotspot (hotspot.hotspotId)}
							<div
								class="hover:border-accent min-h-32 border p-4 transition-colors duration-200 ease-in-out"
							>
								<h4 class="mb-2 font-bold">{hotspot.hotspotName}</h4>
								<p class="mb-3 text-sm">
									<span class="font-semibold">Seasonal Species:</span>
									{hotspot.seasonalSpeciesCount}
								</p>
								<div class="space-y-1 text-xs">
									<p class="font-semibold">Iconic Species:</p>
									<ul class="space-y-0.5 pl-2">
										{#each hotspot.topSpecies as species}
											<li
												class="truncate"
												title="{species.name} (Seen in {species.yearsPresent}/{species.yearsTotal} years)"
											>
												• {species.name}
											</li>
										{/each}
									</ul>
								</div>

								{#if hotspot.rareSpecies && hotspot.rareSpecies.length > 0}
									<div class="mt-2 space-y-1 text-xs">
										<p class="font-semibold">Notable Rarities:</p>
										<ul class="space-y-0.5 pl-2 text-gray-600 italic dark:text-gray-400">
											{#each hotspot.rareSpecies as species}
												<li
													class="truncate"
													title="{species.name} ({species.obsCount} obs, last {species.lastSeenYear})"
												>
													• {species.name}
													<span class="text-[10px] not-italic opacity-70"
														>({species.lastSeenYear})</span
													>
												</li>
											{/each}
										</ul>
									</div>
								{/if}
								<p class="mt-3 text-xs">
									<a
										href="https://ebird.org/hotspot/{hotspot.hotspotId}"
										target="_blank"
										rel="noreferrer"
										class="text-accent hover:underline">View on eBird →</a
									>
								</p>
							</div>
						{:else}
							<p class="col-span-full text-sm text-gray-400">
								No seasonal hotspots found for this period. Try again later as more observation data
								is collected.
							</p>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Target Species -->
	<section class="space-y-6">
		<h2 class="text-accent text-3xl font-bold">Target Species</h2>
		<div class="space-y-4">
			<!-- Species entries will go here -->
			<div class="hover:border-accent border p-6 transition-colors duration-200 ease-in-out">
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
