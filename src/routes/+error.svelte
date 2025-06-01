<script>
	export let error;
	export let status;
</script>

<div class="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16">
	<h1 class="text-accent-red dark:text-accent-red-dark mb-4 text-7xl font-black tracking-tight">
		{status}
	</h1>
	<p class="mb-6 text-center font-mono text-2xl text-black dark:text-white">
		{error?.message ?? 'Something went wrong.'}
	</p>
	<a
		href="/"
		class="bg-accent-red hover:bg-accent-red-dark dark:bg-accent-red-dark dark:hover:bg-accent-red rounded px-6 py-3 text-lg font-bold text-black shadow transition-colors dark:text-white"
	>
		Go Home
	</a>
</div>
