import { build } from 'esbuild';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = await build({ entryPoints: [path.join(root, 'src/app.js')], bundle: true, write: false, format: 'iife', target: 'es2020', minify: true, legalComments: 'inline' });
const template = await readFile(path.join(root, 'src/index.html'), 'utf8');
const css = await readFile(path.join(root, 'src/style.css'), 'utf8');
// A function replacement preserves literal "$&" / "$'" sequences inside bundled code.
const html = template.replace('/* INLINE_STYLE */', () => css).replace('/* INLINE_SCRIPT */', () => bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
await mkdir(path.join(root, 'dist'), { recursive: true });
await writeFile(path.join(root, 'dist/watch-camera-demo.html'), html);
await copyFile(path.join(root, 'node_modules/three/LICENSE'), path.join(root, 'THIRD_PARTY_LICENSES.txt'));
console.log(`Built dist/watch-camera-demo.html (${Buffer.byteLength(html).toLocaleString()} bytes); all assets embedded.`);
