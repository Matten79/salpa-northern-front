// Rakentaa pelin yhdeksi tiedostoksi: docs/index.html (GitHub Pages julkaisee docs-kansion).
// Käyttö: npm run build   |   npm run dev (rakentaa uudelleen aina kun lähdekoodi muuttuu)
import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const watch = process.argv.includes('--watch');

async function writeHtml(js) {
  const template = await readFile('template.html', 'utf8');
  const cover = (await readFile('assets/cover.jpg')).toString('base64');
  const font = (await readFile('assets/oswald-600.woff2')).toString('base64');
  const html = template
    .replace('/*COVER*/', () => cover)
    .replace('/*FONT*/', () => font)
    .replace('/*BUNDLE*/', () => js.replace(/<\/script/g, '<\\/script'));
  await mkdir('docs', { recursive: true });
  await writeFile('docs/index.html', html);
  console.log(`docs/index.html valmis (${(html.length / 1024).toFixed(0)} kt)`);
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
    plugins: [{
      name: 'html',
      setup(build) {
        build.onEnd(async r => { if (!r.errors.length) await writeHtml(r.outputFiles[0].text); });
      },
    }],
  });
  await ctx.watch();
  console.log('Seurataan muutoksia… (Ctrl+C lopettaa)');
} else {
  const r = await esbuild.build(options);
  await writeHtml(r.outputFiles[0].text);
}
