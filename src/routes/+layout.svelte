<script lang="ts">
	import '../app.css';
	import { fade } from 'svelte/transition';
	import { page } from '$app/stores';
	import { derived } from 'svelte/store';
	import { onMount } from 'svelte';

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

	onMount(() => {
		updateDarkMode();
	});

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
						class="ml-2 transform text-4xl font-black tracking-tighter transition-all group-hover:skew-x-2 md:text-4xl lg:text-6xl xl:text-8xl dark:text-white"
					>
						KERAKIS
					</h1>
				</a>
			</div>
			<!-- Navigation section -->
			<nav
				class="mt-6 flex flex-col items-start space-y-4 md:mt-0 md:flex-row md:items-center md:space-y-0 md:space-x-8"
			>
				{#each ['PROJECTS', 'PHOTOS', 'BIRDNET'] as link}
					<a
						href={'/' + link.toLowerCase()}
						class="nav-underline inline-block text-lg font-medium text-black dark:text-white
                {$currentPath === '/' + link.toLowerCase() ? 'active' : ''}"
					>
						{link}
					</a>
				{/each}

				<!-- Dark/Light mode switcher -->
				<button
					on:click={toggleDarkMode}
					class="relative inline-block overflow-hidden bg-black px-4 py-1 text-lg font-bold
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
		</div>
	</footer>
</div>
