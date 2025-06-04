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

			<h2 class="mb-4 text-lg font-bold">EXIF Data</h2>
			<ul class="space-y-2 text-sm">
				{#if modalPhoto.camera}<li><strong>Camera:</strong> {modalPhoto.camera}</li>{/if}
				{#if modalPhoto.lens}<li><strong>Lens:</strong> {modalPhoto.lens}</li>{/if}
				{#if modalPhoto.focalLength}<li>
						<strong>Focal Length:</strong>
						{modalPhoto.focalLength}
					</li>{/if}
				{#if modalPhoto.aperture}<li><strong>Aperture:</strong> {modalPhoto.aperture}</li>{/if}
				{#if modalPhoto.exposure}<li><strong>Exposure:</strong> {modalPhoto.exposure}</li>{/if}
				{#if modalPhoto.iso}<li><strong>ISO:</strong> {modalPhoto.iso}</li>{/if}
			</ul>
		</div>
	</div>
{/if}
