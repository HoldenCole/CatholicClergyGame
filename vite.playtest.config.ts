import { defineConfig, mergeConfig, type Plugin } from 'vite';
import base from './vite.config';

/**
 * The content's `_notes` fields are documentation for the authors, never
 * read by the game: the playtest page, which must stay under the artifact
 * host's size line, sheds them at build time.
 */
function stripNotes(): Plugin {
  const strip = (o: unknown): unknown => {
    if (Array.isArray(o)) return o.map(strip);
    if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o as Record<string, unknown>).filter(([k]) => !k.startsWith('_note')).map(([k, v]) => [k, strip(v)]));
    return o;
  };
  return {
    name: 'vocation:strip-notes',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/src/content/') || !id.endsWith('.json')) return null;
      return { code: JSON.stringify(strip(JSON.parse(code))), map: null };
    },
  };
}

/**
 * A single-chunk build for the playtest page: everything the page needs
 * ends up in one script and one stylesheet so scripts/playtest.mjs can
 * fold them into a single HTML file.
 */
export default mergeConfig(
  base,
  defineConfig({
    plugins: [stripNotes()],
    base: './',
    build: {
      outDir: 'dist-playtest',
      assetsInlineLimit: 100_000_000,
      cssCodeSplit: false,
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  }),
);
