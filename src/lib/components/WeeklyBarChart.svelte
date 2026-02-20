<script lang="ts">
	import { fade } from 'svelte/transition';
	export let weeklyStats: number[] = [];

	const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
	let showInfo = false;
</script>

<div class="group/chart relative mb-8 w-full select-none">
	<!-- Info Icon -->
	<div class="absolute -top-6 -right-2 z-20">
		<button
			class="flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 font-serif text-[10px] font-bold text-gray-500 italic transition-all hover:bg-gray-300 hover:text-gray-700 focus:bg-gray-300 focus:text-gray-700 focus:outline-none dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600 dark:hover:text-zinc-200 dark:focus:bg-zinc-600 dark:focus:text-zinc-200"
			on:mouseenter={() => (showInfo = true)}
			on:mouseleave={(e) => {
				showInfo = false;
				e.currentTarget.blur();
			}}
			on:focus={() => (showInfo = true)}
			on:blur={() => (showInfo = false)}
			on:click={(e) => e.currentTarget.focus()}
			aria-label="Chart Information"
		>
			i
		</button>
		{#if showInfo}
			<div
				transition:fade={{ duration: 150 }}
				class="absolute top-full right-0 z-30 mt-2 w-64 rounded bg-white p-3 shadow-xl ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10"
			>
				<p class="text-xs text-gray-600 dark:text-gray-300">
					This chart shows the <strong class="text-gray-900 dark:text-white"
						>weekly frequency</strong
					> of this species in Knox County over the last 10 years.
				</p>
				<p class="mt-2 text-[10px] text-gray-500 dark:text-gray-400">
					Taller bars indicate a higher percentage of checklists reporting this bird.
				</p>
			</div>
		{/if}
	</div>

	<div class="relative mb-1 flex h-16 items-center gap-px">
		<!-- Center line (Zero/Base) -->
		<div
			class="absolute top-1/2 left-0 w-full -translate-y-px border-t border-gray-300 dark:border-gray-600"
		></div>

		<!-- Guide lines for 50% frequency (25% from top and bottom) -->
		<!-- If a bar touches these lines, it represents 50% frequency -->
		<div
			class="pointer-events-none absolute top-[25%] left-0 w-full border-t border-dashed border-gray-200 opacity-50 dark:border-gray-700"
		></div>
		<div
			class="pointer-events-none absolute bottom-[25%] left-0 w-full border-t border-dashed border-gray-200 opacity-50 dark:border-gray-700"
		></div>

		{#each weeklyStats as freq, i}
			{@const pct = freq * 100}
			<!-- 
                Min height: slightly larger to be visible.
                We center the bars using items-center on the flex parent.
            -->
			{@const height = pct > 0 ? Math.max(pct, 8) : 0}
			<!-- 
                Using aria-label for accessibility. 
                Week index i is 0-52 (53 weeks).
            -->
			<div
				class="group/bar relative flex-1 rounded-[1px] bg-red-500/80 transition-colors hover:bg-red-700 dark:bg-red-500/60 dark:hover:bg-red-300"
				style:height="{height}%"
				role="img"
				aria-label="Week {i + 1}: {pct.toFixed(1)}% frequency"
			>
				<!-- Tooltip -->
				<div
					class="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 z-10 hidden -translate-x-1/2 rounded bg-zinc-800 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg group-hover/bar:block dark:bg-zinc-100 dark:text-zinc-900"
				>
					<span class="font-mono font-bold">Week {i + 1}</span>
					<span class="mx-1 text-red-300 dark:text-red-600">|</span>
					<span>{(freq * 100).toFixed(1)}%</span>
				</div>
			</div>
		{/each}
	</div>

	<div class="mt-1 flex justify-between px-1 font-mono text-[10px] text-gray-400">
		{#each months as m}
			<span class="flex-1 text-center">{m}</span>
		{/each}
	</div>
</div>
