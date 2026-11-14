import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Set this to your real domain once you have one (used for sitemap/OG links).
  // site: 'https://yourname.com',

  // The old /gallery URL now lives under Travel.
  redirects: {
    '/gallery': '/travel/photos',
  },
});
