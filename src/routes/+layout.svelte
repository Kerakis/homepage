<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';

	let darkMode = false;

	function updateDarkMode() {
		darkMode = document.documentElement.classList.contains('dark');
	}

	function toggleDarkMode(): void {
		const isDark = document.documentElement.classList.contains('dark');
		if (isDark) {
			localStorage.theme = 'light';
			document.documentElement.classList.remove('dark');
		} else {
			localStorage.theme = 'dark';
			document.documentElement.classList.add('dark');
		}
		updateDarkMode();
	}

	onMount(() => {
		updateDarkMode();
	});
</script>

<svelte:head>
	<script>
		document.documentElement.classList.toggle(
			'dark',
			localStorage.theme === 'dark' ||
				(!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
		);
	</script>
</svelte:head>
<div class="flex min-h-screen flex-col bg-white transition-colors duration-300 dark:bg-gray-900">
	<!-- Header -->
	<header class="bg-white shadow transition-colors duration-300 dark:bg-gray-800">
		<div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
			<!-- Left: Profile picture and Home link -->
			<div class="flex items-center">
				<img
					src="me.jpg"
					alt="a good looking man with a fake mustache and sombrero"
					class="mr-2 h-10 w-10 rounded-full"
				/>
				<div class="h-10 border-l border-gray-300 dark:border-gray-700"></div>
				<a href="/" class="px-3 text-lg font-bold text-gray-700 hover:underline dark:text-gray-300">
					Kerakis // Rob Upchurch
				</a>
			</div>
			<!-- Right: Navigation links with vertical dividers -->
			<div class="flex items-center">
				<a href="/projects" class="px-3 text-gray-700 hover:underline dark:text-gray-300">
					Projects
				</a>
				<div class="h-10 border-l border-gray-300 dark:border-gray-700"></div>
				<a href="/photos" class="px-3 text-gray-700 hover:underline dark:text-gray-300"> Photos </a>
				<div class="h-10 border-l border-gray-300 dark:border-gray-700"></div>
				<a href="/birdnet" class="px-3 text-gray-700 hover:underline dark:text-gray-300">
					BirdNet
				</a>
			</div>
		</div>
	</header>

	<!-- Main content area -->
	<main class="mx-auto max-w-7xl flex-grow px-4 py-6 text-gray-700 dark:text-gray-300">
		<slot />
	</main>

	<!-- Footer: Social links and dark/light mode toggle -->
	<footer class="bg-white shadow transition-colors duration-300 dark:bg-gray-800">
		<div class="mx-auto flex max-w-7xl flex-col items-center justify-between px-4 py-4 md:flex-row">
			<!-- Social Icons -->
			<div class="flex items-center space-x-4">
				<!-- BlueSky -->
				<a
					href="https://bsky.app/profile/kerakis.bsky.social"
					target="_blank"
					aria-label="BlueSky"
					class="hover:opacity-75"
				>
					<img src="https://via.placeholder.com/24?text=BS" alt="BlueSky" class="h-6 w-6" />
				</a>
				<!-- GitHub -->
				<a
					href="https://github.com/yourhandle"
					target="_blank"
					aria-label="GitHub"
					class="hover:opacity-75"
				>
					<img src="https://via.placeholder.com/24?text=GH" alt="GitHub" class="h-6 w-6" />
				</a>
				<!-- Instagram -->
				<a
					href="https://instagram.com/yourhandle"
					target="_blank"
					aria-label="Instagram"
					class="hover:opacity-75"
				>
					<img src="https://via.placeholder.com/24?text=IG" alt="Instagram" class="h-6 w-6" />
				</a>
				<!-- iNaturalist -->
				<a
					href="https://inaturalist.org/yourhandle"
					target="_blank"
					aria-label="iNaturalist"
					class="hover:opacity-75"
				>
					<img src="https://via.placeholder.com/24?text=iN" alt="iNaturalist" class="h-6 w-6" />
				</a>
				<!-- eBird -->
				<a
					href="https://ebird.org/yourhandle"
					target="_blank"
					aria-label="eBird"
					class="hover:opacity-75"
				>
					<img src="https://via.placeholder.com/24?text=eB" alt="eBird" class="h-6 w-6" />
				</a>
				<!-- Discord -->
				<a
					href="https://discord.gg/yourinvite"
					target="_blank"
					aria-label="Discord"
					class="hover:opacity-75"
				>
					<img src="https://via.placeholder.com/24?text=DC" alt="Discord" class="h-6 w-6" />
				</a>
				<!-- Reddit -->
				<a
					href="https://reddit.com/user/yourhandle"
					target="_blank"
					aria-label="Reddit"
					class="hover:opacity-75"
				>
					<img src="https://via.placeholder.com/24?text=RB" alt="Reddit" class="h-6 w-6" />
				</a>
				<!-- Email -->
				<a href="mailto:youremail@example.com" aria-label="Email" class="hover:opacity-75">
					<img src="https://via.placeholder.com/24?text=EM" alt="Email" class="h-6 w-6" />
				</a>
				<!-- Moxfield -->
				<a
					href="https://moxfield.com/yourhandle"
					target="_blank"
					aria-label="Moxfield"
					class="hover:opacity-75"
				>
					<img src="https://via.placeholder.com/24?text=MX" alt="Moxfield" class="h-6 w-6" />
				</a>
			</div>
			<!-- Dark/Light Mode Toggle -->
			<div class="mt-4 md:mt-0">
				<button
					on:click={toggleDarkMode}
					class="rounded border p-2 text-gray-700 transition-colors duration-300 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
					aria-label="Toggle dark mode"
				>
					{#if darkMode}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							class="h-6 w-6"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 3v1m0 16v1m8.66-8.66h1M3.34 12h1m9.32 7.66l.71.71M5.66 18.34l-.71.71m9.9-15.32l.71-.71M5.66 5.66l-.71-.71M12 5a7 7 0 100 14 7 7 0 000-14z"
							/>
						</svg>
					{:else}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							class="h-6 w-6"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
							/>
						</svg>
					{/if}
				</button>
			</div>
		</div>
	</footer>
</div>
