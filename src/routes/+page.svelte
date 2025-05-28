<script lang="ts">
	const text =
		"I'm Rob <span class='text-accent-red'>AKA</span> Kerakis. Feel free to call me either. I'm a lot of things. Director of Community Relations. Goofball. Amateur wildlife photographer. Registered Vascular Interventional Technologist. Birder. UTK graduate. Nature lover. Occasional wannabe programmer. Cat and dog dad.";
	const segments = text
		.split('.')
		.filter(Boolean)
		.map((segment) => segment.trim());
</script>

<div class="flex min-h-[70vh] flex-col items-center md:flex-row md:justify-between md:gap-8">
	<!-- Left side - Massive Hello -->
	<div class="p-8 md:w-2/5">
		<h1
			class="transform font-sans text-6xl font-black tracking-tighter transition-all hover:skew-x-2 sm:text-7xl md:text-8xl lg:text-[10rem] xl:text-[12rem]"
		>
			HELLO
		</h1>
	</div>

	<!-- Separator with gradient edges -->
	<div class="relative w-3/4 md:w-px">
		<!-- Mobile horizontal line -->
		<div
			class="h-px w-full bg-gradient-to-r from-transparent via-black to-transparent md:hidden dark:via-white"
		></div>
		<!-- Desktop vertical line -->
		<div class="hidden h-[50vh] w-px md:block">
			<div
				class="h-full w-px rotate-[15deg] transform bg-gradient-to-b from-transparent via-black to-transparent dark:via-white"
			></div>
		</div>
	</div>

	<!-- Right side - Content -->
	<div class="p-8 md:w-1/2">
		<p
			class="text-content font-mono text-2xl leading-relaxed tracking-tight sm:text-3xl md:text-3xl lg:text-4xl xl:text-5xl"
		>
			{#each segments as segment, i}
				{@html segment}{#if i < segments.length - 1}<span class="text-accent-red">.</span>{' '}{/if}
			{/each}{#if text.trim().endsWith('.')}<span class="text-accent-red">.</span>{/if}
		</p>
	</div>
</div>
