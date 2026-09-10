// Fold the playtest build into one HTML file: dist-playtest/vocation.html.
// The result is a page fragment (no <html>/<head>/<body>) so it can be
// published as-is or dropped into any host page.
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
  '<title>Vocation</title>',
  `<style>${style}</style>`,
  '<div id="root"></div>',
  `<script type="module">${script}</script>`,
].join('\n');
fs.writeFileSync(path.join(dir, 'vocation.html'), out);
console.log(`wrote dist-playtest/vocation.html (${(out.length / 1024 / 1024).toFixed(2)} MB)`);
