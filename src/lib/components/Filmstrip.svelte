<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import type { Photo } from '$lib/utils/photoUtils';

	export let photos: Photo[] = [];
	export let currentIndex: number = 0;
	export let onChangeIndex: (index: number) => void;

	let filmstripElement: HTMLDivElement;
	let hoveredIdx: number | null = null;

	// Scroll active thumbnail into view
	function scrollActiveThumbnail() {
		if (
			filmstripElement &&
			photos.length > 0 &&
			currentIndex >= 0 &&
			currentIndex < photos.length
		) {
			const activeThumb = filmstripElement.children[currentIndex] as HTMLElement;
			if (activeThumb && typeof activeThumb.scrollIntoView === 'function') {
				activeThumb.scrollIntoView({
					behavior: 'smooth',
					inline: 'center',
					block: 'nearest'
				});
			}
		}
	}

	onMount(() => {
		scrollActiveThumbnail();
	});

	afterUpdate(() => {
		// This ensures scrolling happens after currentIndex prop updates and DOM reflects it
		scrollActiveThumbnail();
	});
</script>

{#if photos.length > 0}
	<div
		bind:this={filmstripElement}
		class="filmstrip flex w-full items-center justify-center gap-2 overflow-x-auto bg-black/70 px-4 py-2 dark:bg-black/80"
		style="z-index:20; white-space: nowrap; padding-left: 2rem; padding-right: 2rem;"
		role="toolbar"
		aria-label="Photo filmstrip"
	>
		{#each photos as thumb, idx (thumb.src)}
			<button
				type="button"
				class="mx-1 flex-shrink-0 cursor-pointer rounded border-2 transition-all"
				style="border-color: {idx === currentIndex
					? 'var(--color-accent)'
					: hoveredIdx === idx
						? 'var(--color-accent)'
						: '#444'}; outline: none;"
				on:click={(e) => {
					e.preventDefault();
					onChangeIndex(idx);
				}}
				tabindex="0"
				aria-label={`Go to photo ${idx + 1}${thumb.title ? ': ' + thumb.title : ''}`}
				aria-current={idx === currentIndex ? 'true' : 'false'}
				id={`filmstrip-thumb-${idx}`}
				on:mouseenter={() => (hoveredIdx = idx)}
				on:mouseleave={() => (hoveredIdx = null)}
			>
				<img
					src={thumb.thumbnailSrc ?? thumb.src}
					alt={thumb.title ?? `Photo ${idx + 1}`}
					class="h-12 w-auto rounded object-cover"
					style="opacity: {idx === currentIndex
						? 1
						: 0.6}; border-radius: 4px; border: 2px solid transparent; box-shadow: {idx ===
					currentIndex
						? '0 0 0 2px var(--color-accent)'
						: 'none'}; transition: border-color 0.15s, box-shadow 0.15s;"
					loading="lazy"
				/>
			</button>
		{/each}
	</div>
{/if}
