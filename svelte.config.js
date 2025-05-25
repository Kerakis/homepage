import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const dev = process.env.NODE_ENV === 'development';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			fallback: 'index.html' // enables SPA fallback routing for GitHub Pages
		}),
		paths: {
			base: dev ? '' : '/homepage' // change 'your-repo-name' to match your repository name
		}
	}
};

export default config;
