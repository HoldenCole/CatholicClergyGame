/* eslint-env node */
// Fold the playtest build into one HTML file: dist-playtest/vocation.html.
// The result is one complete page: it runs from GitHub Pages, from a
// release asset opened off the disk, or from any host page.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('dist-playtest');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const js = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
const css = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
if (js.length !== 1) throw new Error(`expected one script, found ${js.length}`);
const read = (p) => fs.readFileSync(path.join(dir, p.replace(/^\.?\//, '')), 'utf8');
const script = read(js[0]).replace(/<\/script/gi, '<\\/script');
const style = css.map(read).join('\n');
const out = [
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<title>Vocation</title>',
  `<style>${style}</style>`,
  '</head>',
  '<body>',
  '<div id="root"></div>',
  `<script type="module">${script}</script>`,
  '</body>',
  '</html>',
].join('\n');
fs.writeFileSync(path.join(dir, 'vocation.html'), out);
console.log(`wrote dist-playtest/vocation.html (${(out.length / 1024 / 1024).toFixed(2)} MB)`);
