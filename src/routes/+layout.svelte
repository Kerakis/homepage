<script lang="ts">
	import '../app.css';
	import { fade } from 'svelte/transition';
	import { page } from '$app/stores';
	import { derived } from 'svelte/store';

	let darkMode = false;

	// Use a derived store for the current path
	const currentPath = derived(page, ($page) => $page.url.pathname);

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

	// No need for onMount to set currentPath anymore
	export const prerender = true;
</script>

<svelte:head>
	<!--
    Inline script to set the initial theme before the page renders.
    It respects the OS preference unless an explicit theme exists in localStorage.
  -->
	<script>
		if (typeof window !== 'undefined') {
			document.documentElement.classList.toggle(
				'dark',
				localStorage.theme === 'dark' ||
					(!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
			);
		}
	</script>
</svelte:head>

<div class="min-h-screen bg-white dark:bg-black">
	<!-- Main header section -->
	<header class="container mx-auto px-4 py-8 md:py-16">
		<div class="flex flex-col md:flex-row md:items-center md:justify-between">
			<!-- Large stylized header -->
			<a href="/" aria-label="Home">
				<h1
					class="transform text-6xl font-black tracking-tighter transition-all hover:skew-x-2 sm:text-2xl md:text-4xl lg:text-6xl xl:text-8xl dark:text-white"
				>
					KERAKIS
				</h1>
			</a>
			<!-- Navigation section -->
			<nav class="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-8">
				{#each ['PROJECTS', 'PHOTOS', 'BIRDNET'] as link}
					<a
						href={'/' + link.toLowerCase()}
						class="nav-underline inline-block text-lg font-medium text-black dark:text-white {$currentPath ===
						'/' + link.toLowerCase()
							? 'active'
							: ''}"
					>
						{link}
					</a>
				{/each}
			</nav>
		</div>
	</header>

	<!-- Main content -->
	<main class="container mx-auto px-4 py-8 font-black dark:text-white" transition:fade>
		<slot />
	</main>

	<!-- Footer with social links -->
	<footer class="container mx-auto px-4 py-16">
		<div class="flex flex-col items-center space-y-8">
			<!-- Social links -->
			<div class="flex flex-wrap justify-center gap-6">
				<!-- BlueSky -->
				<a
					href="https://bsky.app/profile/kerakis.bsky.social"
					target="_blank"
					aria-label="BlueSky"
					class="transform transition-transform hover:scale-110"
				>
					<img src="https://via.placeholder.com/24?text=GH" alt="BlueSky" class="h-6 w-6" />
				</a>
				<!-- GitHub -->
				<a
					href="https://github.com/yourhandle"
					target="_blank"
					aria-label="GitHub"
					class="transform transition-transform hover:scale-110"
				>
					<img src="https://via.placeholder.com/24?text=GH" alt="GitHub" class="h-6 w-6" />
				</a>
				<!-- Instagram -->
				<a
					href="https://instagram.com/yourhandle"
					target="_blank"
					aria-label="Instagram"
					class="transform transition-transform hover:scale-110"
				>
					<img src="https://via.placeholder.com/24?text=IG" alt="Instagram" class="h-6 w-6" />
				</a>
				<!-- iNaturalist -->
				<a
					href="https://inaturalist.org/yourhandle"
					target="_blank"
					aria-label="iNaturalist"
					class="transform transition-transform hover:scale-110"
				>
					<img src="https://via.placeholder.com/24?text=iN" alt="iNaturalist" class="h-6 w-6" />
				</a>
				<!-- eBird -->
				<a
					href="https://ebird.org/yourhandle"
					target="_blank"
					aria-label="eBird"
					class="transform transition-transform hover:scale-110"
				>
					<img src="https://via.placeholder.com/24?text=eB" alt="eBird" class="h-6 w-6" />
				</a>
				<!-- Discord -->
				<a
					href="https://discord.gg/yourinvite"
					target="_blank"
					aria-label="Discord"
					class="transform transition-transform hover:scale-110"
				>
					<img src="https://via.placeholder.com/24?text=DC" alt="Discord" class="h-6 w-6" />
				</a>
				<!-- Reddit -->
				<a
					href="https://reddit.com/user/yourhandle"
					target="_blank"
					aria-label="Reddit"
					class="transform transition-transform hover:scale-110"
				>
					<img src="https://via.placeholder.com/24?text=RB" alt="Reddit" class="h-6 w-6" />
				</a>
				<!-- Email -->
				<a
					href="mailto:youremail@example.com"
					aria-label="Email"
					class="transform transition-transform hover:scale-110"
				>
					<img src="https://via.placeholder.com/24?text=EM" alt="Email" class="h-6 w-6" />
				</a>
				<!-- Moxfield -->
				<a
					href="https://moxfield.com/yourhandle"
					target="_blank"
					aria-label="Moxfield"
					class="transform transition-transform hover:scale-110"
				>
					<img src="https://via.placeholder.com/24?text=MX" alt="Moxfield" class="h-6 w-6" />
				</a>
			</div>

			<!-- Dark mode toggle -->
			<button
				on:click={toggleDarkMode}
				class="rounded-full border border-black p-2 dark:border-white"
				aria-label="Toggle dark mode"
			>
				{#if darkMode}
					<!-- Sun icon for switching to Light Mode -->
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
					<!-- Moon icon for switching to Dark Mode -->
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
	</footer>
</div>
