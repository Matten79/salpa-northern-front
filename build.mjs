// Rakentaa pelin: docs/index.html (yksi tiedosto) + PWA-tiedostot. GitHub Pages julkaisee docs-kansion.
// Käyttö: npm run build   |   npm run dev (rakentaa uudelleen aina kun lähdekoodi muuttuu)
import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';

const watch = process.argv.includes('--watch');

const PWA_HEAD = `<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-192.png">
<link rel="icon" type="image/png" href="icon-192.png">
<script>if ('serviceWorker' in navigator && location.protocol === 'https:') addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));</script>`;

const MANIFEST = {
  name: 'Salpa: Northern Front',
  short_name: 'Salpa',
  description: 'Itärajan puolustus – tower defence -peli Suomen itärajalta.',
  lang: 'fi',
  start_url: './',
  scope: './',
  display: 'fullscreen',
  orientation: 'any',
  background_color: '#0d141b',
  theme_color: '#0d141b',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
};

// Verkko ensin, välimuisti varalla: päivitykset tulevat heti, peli toimii myös ilman nettiä.
const swSource = version => `const CACHE = 'salpa-${version}';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
`;

async function writeAll(js) {
  const template = await readFile('template.html', 'utf8');
  const cover = (await readFile('assets/cover.jpg')).toString('base64');
  const font = (await readFile('assets/oswald-600.woff2')).toString('base64');
  const html = template
    .replace('<!--PWA-->', () => PWA_HEAD)
    .replace('/*COVER*/', () => cover)
    .replace('/*FONT*/', () => font)
    .replace('/*BUNDLE*/', () => js.replace(/<\/script/g, '<\\/script'));
  await mkdir('docs', { recursive: true });
  await writeFile('docs/index.html', html);
  await writeFile('docs/manifest.webmanifest', JSON.stringify(MANIFEST, null, 2));
  await writeFile('docs/sw.js', swSource(Date.now().toString(36)));
  for (const n of [192, 512]) await copyFile(`assets/icon-${n}.png`, `docs/icon-${n}.png`);
  console.log(`docs/index.html valmis (${(html.length / 1024).toFixed(0)} kt) + PWA-tiedostot`);
}

const options = {
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  write: false,
  target: ['es2020'],
  logLevel: 'warning',
};

if (watch) {
  const ctx = await esbuild.context({
    ...options,
    plugins: [{ name: 'html', setup(build) { build.onEnd(async r => { if (!r.errors.length) await writeAll(r.outputFiles[0].text); }); } }],
  });
  await ctx.watch();
  console.log('Seurataan muutoksia… (Ctrl+C lopettaa)');
} else {
  const r = await esbuild.build(options);
  await writeAll(r.outputFiles[0].text);
}
