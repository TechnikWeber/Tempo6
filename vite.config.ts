import { defineConfig } from 'vite';

// Relative base so the build also runs from a GitHub Pages sub-path.
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
});
