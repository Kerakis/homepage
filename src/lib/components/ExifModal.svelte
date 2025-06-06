<script lang="ts">
	import type { Writable } from 'svelte/store';
	import { onMount, onDestroy } from 'svelte';

	export let showExif: Writable<boolean>;
	export let modalPhoto: {
		camera?: string;
		lens?: string;
		focalLength?: string;
		aperture?: string;
		exposure?: string;
		iso?: number;
	} | null;

	let dialogElement: HTMLDivElement | null = null;

	function closeModal() {
		$showExif = false;
	}

	function handleDialogKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closeModal();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === dialogElement) {
			closeModal();
		}
	}

	// Focus management for accessibility
	let previouslyFocusedElement: HTMLElement | null = null;

	onMount(() => {
		if ($showExif && dialogElement) {
			previouslyFocusedElement = document.activeElement as HTMLElement;
			dialogElement.focus();
		}
	});

	onDestroy(() => {
		previouslyFocusedElement?.focus();
	});

	// Reactive statement to handle focus when showExif changes
	$: if ($showExif && dialogElement) {
		previouslyFocusedElement = document.activeElement as HTMLElement;
		dialogElement.focus();
	} else if (!$showExif && previouslyFocusedElement) {
		if (document.body.contains(previouslyFocusedElement)) {
			previouslyFocusedElement.focus();
		}
		previouslyFocusedElement = null;
	}
</script>

{#if $showExif && modalPhoto}
	<div
		bind:this={dialogElement}
		class="fixed inset-0 z-60 flex items-center justify-center bg-black/80"
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		on:click={handleBackdropClick}
		on:keydown={handleDialogKeydown}
		aria-label="EXIF Data Modal"
	>
		<div
			role="document"
			class="relative w-11/12 max-w-md rounded bg-black/90 p-6 text-white shadow-lg"
		>
			<!-- Close Button -->
			<button
				class="absolute top-2 right-2 rounded-full bg-black/60 p-2 text-white hover:bg-gray-700"
				on:click={closeModal}
				aria-label="Close EXIF modal"
				title="Close"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>

			<h2 class="mb-4 text-center text-lg font-bold">Camera settings</h2>
			<div class="grid items-center gap-x-4 gap-y-2" style="grid-template-columns: auto 1fr;">
				{#if modalPhoto.camera}
					<i class="fa-solid fa-camera text-accent justify-self-center text-[1.5rem]"></i>
					<span class="font-semibold">{modalPhoto.camera}</span>
				{/if}
				{#if modalPhoto.lens}
					<svg
						class="text-accent h-7 w-7 justify-self-center"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<rect x="3" y="6" width="14" height="12" rx="1" stroke="currentColor" fill="none" />
						<rect x="17" y="6" width="2" height="12" rx="0.5" stroke="currentColor" fill="none" />
						<rect x="19" y="6" width="2" height="12" rx="0.5" stroke="currentColor" fill="none" />
						<rect x="2" y="9" width="1" height="6" rx="0.5" stroke="currentColor" fill="none" />
					</svg>
					<span>{modalPhoto.lens}</span>
				{/if}
				{#if modalPhoto.focalLength}
					<svg
						class="text-accent h-6 w-6 justify-self-center"
						viewBox="0 0 512 512"
						fill="none"
						stroke="currentColor"
						stroke-width="32"
					>
						<path
							d="M409.313 70.688l56.010-31.803-13.56-23.905-424.608 241.12 431.837 240.956 13.386-23.997-50.714-28.294c32.801-47.379 117.729-201.089-12.351-374.077zM397.548 431.296l-70.231-39.188c31.803-18.050 54.288-71.394 54.288-136.118 0-66.373-23.666-120.688-56.762-137.336l60.363-34.276c124.38 162.616 41.012 306.503 12.342 346.92zM303.385 140.772c23.997 0 50.733 47.315 50.733 115.219s-26.736 115.219-50.733 115.219-50.742-47.315-50.742-115.219 26.746-115.219 50.742-115.219zM242.519 165.4c-10.894 24.482-17.373 55.891-17.373 90.59 0 33.635 6.13 64.129 16.428 88.281l-158.382-88.391 159.327-90.479z"
							stroke="currentColor"
							fill="none"
						/>
					</svg>
					<span>{modalPhoto.focalLength}</span>
				{/if}
				{#if modalPhoto.aperture}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="feather text-accent feather-aperture h-6 w-6 justify-self-center"
					>
						<circle cx="12" cy="12" r="10"></circle>
						<line x1="14.31" y1="8" x2="20.05" y2="17.94"></line>
						<line x1="9.69" y1="8" x2="21.17" y2="8"></line>
						<line x1="7.38" y1="12" x2="13.12" y2="2.06"></line>
						<line x1="9.69" y1="16" x2="3.95" y2="6.06"></line>
						<line x1="14.31" y1="16" x2="2.83" y2="16"></line>
						<line x1="16.62" y1="12" x2="10.88" y2="21.94"></line>
					</svg>
					<span>{modalPhoto.aperture}</span>
				{/if}
				{#if modalPhoto.exposure}
					<i class="fa-solid fa-stopwatch text-accent justify-self-center text-[1.5rem]"></i>
					<span>{modalPhoto.exposure}</span>
				{/if}
				{#if modalPhoto.iso}
					<svg class="text-accent h-7 w-7 justify-self-center" viewBox="0 0 24 24">
						<path
							d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM5.5 7.5h2v-2H9v2h2V9H9v2H7.5V9h-2V7.5zM19 19H5L19 5v14zm-2-2v-1.5h-5V17h5z"
							fill="var(--color-accent)"
						></path>
					</svg>
					<span>ISO {modalPhoto.iso}</span>
				{/if}
			</div>
		</div>
	</div>
{/if}
