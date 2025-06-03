<script lang="ts">
	import '../app.css';
	import { fade } from 'svelte/transition';
	import { page } from '$app/state';
	import { beforeNavigate, afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { darkMode } from '$lib/stores/darkMode';

	let loading = false;

	function updateDarkMode() {
		const isDark = document.documentElement.classList.contains('dark');
		darkMode.set(isDark);
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

		beforeNavigate(() => {
			loading = true;
		});
		afterNavigate(() => {
			loading = false;
		});
	});
</script>

<svelte:head>
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
	{#if loading}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
			<svg
				class="text-accent h-12 w-12 animate-spin"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
			>
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
			</svg>
			<span class="ml-4 text-xl text-white">Loading...</span>
		</div>
	{/if}
	<!-- Main header section -->
	<header class="container mx-auto px-4 py-8 md:py-2">
		<div class="flex flex-col md:flex-row md:items-center md:justify-between">
			<!-- Logo and Header side-by-side -->
			<div class="mb-6 flex items-center space-x-4 md:mb-0">
				<a href="/" aria-label="Home" class="group flex items-center">
					<img
						src="icon.png"
						alt="Logo"
						class="h-10 w-10 object-contain transition-all md:h-16 md:w-16 lg:h-28 lg:w-28 xl:h-36 xl:w-36
        dark:drop-shadow-[0_0_1.5px_white]"
						style="min-width:2.5rem;"
					/>
					<h1
						class="font-roboto ml-2 transform text-4xl font-black tracking-tighter transition-all group-hover:skew-x-2 md:text-4xl lg:text-6xl xl:text-8xl dark:text-white"
					>
						KERAKIS
					</h1>
				</a>
			</div>
			<!-- Navigation section -->
			<nav
				class="mt-6 flex flex-col items-start space-y-4 font-sans md:mt-0 md:flex-row md:items-center md:space-y-0 md:space-x-8"
			>
				{#each ['PROJECTS', 'PHOTOS', 'BIRDNET'] as link}
					<a
						href={'/' + link.toLowerCase()}
						class="nav-underline inline-block text-lg font-medium text-black dark:text-white
            {page.url.pathname === '/' + link.toLowerCase() ? 'active' : ''}"
					>
						{link}
					</a>
				{/each}

				<!-- Dark/Light mode switcher -->
				<button
					on:click={toggleDarkMode}
					class="relative inline-block overflow-hidden bg-black px-4 py-1 text-xs font-bold
        tracking-widest text-white transition-colors focus:outline-none md:ml-8 md:-skew-y-5 dark:bg-white
        dark:text-black"
					aria-label="Toggle dark mode"
				>
					<span class="relative z-10">{darkMode ? 'LIGHT' : 'DARK'}</span>
				</button>
			</nav>
		</div>
	</header>

	<!-- Main content -->
	<main class="container mx-auto px-4 py-8 font-black dark:text-white" transition:fade>
		<slot />
	</main>

	<!-- Footer -->
	<footer class="container mx-auto px-4 py-16 pb-32 md:pb-24">
		<div class="flex flex-col items-center space-y-8">
			<!-- Social links -->
			<div class="flex flex-wrap justify-center gap-6">
				<!-- BlueSky (using a generic globe icon as placeholder) -->
				<a
					href="https://bsky.app/profile/kerakis.bsky.social"
					target="_blank"
					aria-label="BlueSky"
					class="transform text-black transition-transform hover:scale-110 dark:text-white"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<circle cx="12" cy="12" r="10" stroke-width="2" />
						<path stroke-width="2" d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
					</svg>
				</a>
				<!-- GitHub -->
				<a
					href="https://github.com/Kerakis/"
					target="_blank"
					aria-label="GitHub"
					class="transform text-black transition-transform hover:scale-110 dark:text-white"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.184 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.004.07 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.221-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.295 2.748-1.025 2.748-1.025.546 1.378.202 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.847-2.337 4.695-4.566 4.944.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .267.18.579.688.481C19.138 20.203 22 16.447 22 12.021 22 6.484 17.523 2 12 2z"
						/>
					</svg>
				</a>
				<!-- Instagram -->
				<a
					href="https://www.instagram.com/rob.upchurch.photography/"
					target="_blank"
					aria-label="Instagram"
					class="transform text-black transition-transform hover:scale-110 dark:text-white"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<rect width="20" height="20" x="2" y="2" rx="5" stroke-width="2" />
						<circle cx="12" cy="12" r="5" stroke-width="2" />
						<circle cx="17" cy="7" r="1.5" fill="currentColor" />
					</svg>
				</a>
				<!-- iNaturalist (using a leaf icon) -->
				<a
					href="https://www.inaturalist.org/people/kerakis"
					target="_blank"
					aria-label="iNaturalist"
					class="transform text-black transition-transform hover:scale-110 dark:text-white"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path stroke-width="2" d="M12 22c6-5 8-10 8-13a8 8 0 10-16 0c0 3 2 8 8 13z" />
					</svg>
				</a>
				<!-- eBird (using a bird icon) -->
				<a
					href="https://ebird.org/profile/NTIyOTE3NQ/US"
					target="_blank"
					aria-label="eBird"
					class="transform text-black transition-transform hover:scale-110 dark:text-white"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path stroke-width="2" d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12z" />
						<circle cx="12" cy="12" r="3" fill="currentColor" />
					</svg>
				</a>
				<!-- Discord -->
				<a
					href="https://discordapp.com/users/166722144993148938"
					target="_blank"
					aria-label="Discord"
					class="transform text-black transition-transform hover:scale-110 dark:text-white"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							d="M20.317 4.369A19.791 19.791 0 0016.885 3.1a.074.074 0 00-.079.037c-.347.607-.734 1.396-1.006 2.01a18.524 18.524 0 00-5.6 0 12.51 12.51 0 00-1.017-2.01.077.077 0 00-.079-.037c-1.432.327-2.813.812-4.105 1.47a.069.069 0 00-.032.027C.533 9.093-.319 13.579.099 18.057a.08.08 0 00.031.056c1.733 1.27 3.416 2.048 5.077 2.568a.077.077 0 00.084-.027c.391-.535.739-1.1 1.032-1.691a.076.076 0 00-.041-.104c-.552-.21-1.077-.467-1.588-.76a.077.077 0 01-.008-.127c.107-.08.214-.163.316-.246a.074.074 0 01.077-.01c3.3 1.515 6.872 1.515 10.146 0a.073.073 0 01.078.009c.102.083.209.166.316.246a.077.077 0 01-.006.127 12.298 12.298 0 01-1.589.76.076.076 0 00-.04.105c.294.591.641 1.156 1.032 1.691a.076.076 0 00.084.027c1.661-.52 3.344-1.298 5.077-2.568a.077.077 0 00.031-.055c.417-4.479-.355-8.964-2.708-13.661a.061.061 0 00-.031-.028zM8.02 15.331c-1.006 0-1.823-.923-1.823-2.057 0-1.135.807-2.058 1.823-2.058 1.018 0 1.824.923 1.824 2.058 0 1.134-.806 2.057-1.824 2.057zm7.974 0c-1.006 0-1.823-.923-1.823-2.057 0-1.135.807-2.058 1.823-2.058 1.018 0 1.824.923 1.824 2.058 0 1.134-.806 2.057-1.824 2.057z"
						/>
					</svg>
				</a>
				<!-- Reddit -->
				<a
					href="https://reddit.com/user/kerakis"
					target="_blank"
					aria-label="Reddit"
					class="transform text-black transition-transform hover:scale-110 dark:text-white"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.302 3.438 9.8 8.205 11.385.6.111.82-.261.82-.577 0-.285-.011-1.04-.017-2.042-3.338.726-4.042-1.415-4.042-1.415-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.809 1.304 3.495.997.108-.775.418-1.305.762-1.606-2.665-.305-5.466-1.334-5.466-5.931 0-1.31.469-2.381 1.236-3.221-.124-.304-.535-1.527.117-3.182 0 0 1.008-.322 3.301 1.23a11.52 11.52 0 013.003-.404c1.018.005 2.045.138 3.003.404 2.291-1.553 3.297-1.23 3.297-1.23.653 1.655.242 2.878.119 3.182.77.84 1.235 1.911 1.235 3.221 0 4.609-2.803 5.624-5.475 5.921.43.372.823 1.104.823 2.225 0 1.606-.015 2.898-.015 3.293 0 .319.216.694.825.576C20.565 21.796 24 17.298 24 12z"
						/>
					</svg>
				</a>
				<!-- Email -->
				<a
					href="mailto:me@kerakis.online"
					aria-label="Email"
					class="transform text-black transition-transform hover:scale-110 dark:text-white"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<rect width="20" height="16" x="2" y="4" rx="3" stroke-width="2" />
						<path stroke-width="2" d="M2 6l10 7 10-7" />
					</svg>
				</a>
				<!-- Moxfield (using a generic card icon) -->
				<a
					href="https://kerakis.moxfield.com/"
					target="_blank"
					aria-label="Moxfield"
					class="transform text-black transition-transform hover:scale-110 dark:text-white"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<rect width="18" height="12" x="3" y="6" rx="2" stroke-width="2" />
						<rect width="6" height="4" x="9" y="10" rx="1" fill="currentColor" />
					</svg>
				</a>
			</div>
		</div>
	</footer>
</div>
