import { build } from 'esbuild';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = await build({ entryPoints: [path.join(root, 'src/app.js')], bundle: true, write: false, format: 'iife', target: 'es2020', minify: true, legalComments: 'inline' });
const template = await readFile(path.join(root, 'src/index.html'), 'utf8');
const css = await readFile(path.join(root, 'src/style.css'), 'utf8');
const favicon = await readFile(path.join(root, 'src/favicon.svg'), 'utf8');
// A function replacement preserves literal "$&" / "$'" sequences inside bundled code.
const html = template.replace('/* INLINE_FAVICON */', () => `data:image/svg+xml,${encodeURIComponent(favicon)}`).replace('/* INLINE_STYLE */', () => css).replace('/* INLINE_SCRIPT */', () => bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
await mkdir(path.join(root, 'dist'), { recursive: true });
await writeFile(path.join(root, 'dist/watch-camera-demo.html'), html);
// Branch-based GitHub Pages serves /docs; keep its entry point identical to the offline build.
await mkdir(path.join(root, 'docs'), { recursive: true });
await writeFile(path.join(root, 'docs/index.html'), html);
await writeFile(path.join(root, 'docs/.nojekyll'), '');
await copyFile(path.join(root, 'node_modules/three/LICENSE'), path.join(root, 'THIRD_PARTY_LICENSES.txt'));
// A small standalone fixture lets CI/manual browser QA test native scrolling
// with exactly the production viewer template, CSS and helper, without WebGL.
const viewer=await build({entryPoints:[path.join(root,'tests/browser/photo-viewer-fixture.js')],bundle:true,write:false,format:'iife',target:'es2020',minify:true});
const dialog=template.match(/<dialog id="photoDialog"[\s\S]*?<\/dialog>/)[0];
await mkdir(path.join(root,'docs/qa'),{recursive:true});
await writeFile(path.join(root,'docs/qa/photo-viewer.html'),`<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>照片查看器滚动验证</title><style>${css}</style><body>${dialog}<script>${viewer.outputFiles[0].text}</script></body></html>`);
console.log(`Built dist/watch-camera-demo.html and docs/index.html (${Buffer.byteLength(html).toLocaleString()} bytes each); all assets embedded.`);
