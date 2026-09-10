import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';

/**
 * A single-chunk build for the playtest page: everything the page needs
 * ends up in one script and one stylesheet so scripts/playtest.mjs can
 * fold them into a single HTML file.
 */
export default mergeConfig(
  base,
  defineConfig({
    base: './',
    build: {
      outDir: 'dist-playtest',
      assetsInlineLimit: 100_000_000,
      cssCodeSplit: false,
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  }),
);
