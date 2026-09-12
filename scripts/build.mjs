import { readFile, writeFile, mkdir, copyFile, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { runtimeFiles, images, sounds } from './site-files.mjs';

const root = resolve(import.meta.dirname, '..');
const output = join(root, 'dist');
const files = [...runtimeFiles,...images.map(name=>'assets/images/'+name),...sounds.map(name=>'assets/sounds/'+name)];
const hash = createHash('sha256');
for (const name of files) {
  const path = join(root,name);
  if (!(await lstat(path)).isFile()) throw new Error(`Expected a regular source file: ${name}`);
  hash.update(name); hash.update(await readFile(path));
}
const version = hash.digest('hex').slice(0,12);
const fingerprint = name => name.replace(/\.(js|css)$/,`.${version}.$1`);
const modules = runtimeFiles.filter(name=>name.endsWith('.js'));
await mkdir(output,{recursive:true});
// Retain older fingerprinted bundles locally so an already-open tab can finish loading.
// CI uses a fresh checkout. No recursive cleanup of a user-selected path is required.
for (const name of files) {
  const target = join(output,fingerprint(name));
  await mkdir(resolve(target,'..'),{recursive:true});
  if (/\.(html|css|js)$/.test(name)) {
    let text = await readFile(join(root,name),'utf8');
    if (name.endsWith('.js')) {
      for (const module of modules) text = text.replaceAll(`'./${module}'`,`'./${fingerprint(module)}'`);
      if (name === 'resources.js') text = text.replace("'development'",`'${version}'`);
    }
    if (name === 'index.html') {
      text = text.replace('href="style.css"',`href="${fingerprint('style.css')}"`).replace('src="game.js"',`src="${fingerprint('game.js')}"`);
      text = text.replace(/((?:src|href)="assets\/[^"?]+)(")/g,`$1?v=${version}$2`);
    }
    if (name === 'style.css') {
      text = text.replace(/url\('([^']+)'\)/g,(_,url)=>`url('${url}?v=${version}')`);
      // Runtime image URLs carry a cache key; do not use suffix selectors that stop matching it.
    }
    await writeFile(target,text);
  } else await copyFile(join(root,name),target);
}
await writeFile(join(output,'release.json'),JSON.stringify({version,files:files.map(fingerprint)},null,2)+'\n');
console.log(`Built dist/: ${files.length} files, release ${version}. No backend or runtime dependencies.`);
