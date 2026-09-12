import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from '../scripts/static-server.mjs';
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
test('Production release uses fingerprinted, case-correct, relative module and asset paths',async()=>{
  execFileSync(process.execPath,['scripts/build.mjs'],{cwd:project});
  const release=JSON.parse(await readFile(resolve(project,'dist/release.json'),'utf8'));
  const files=new Set(release.files);
  assert.equal(release.files.length,54);
  for(const file of files) {
    const actual=await readdir(resolve(project,'dist',posix.dirname(file)));
    assert.ok(actual.includes(posix.basename(file)),`Exact case: ${file}`);
    if(!/\.(html|css|js)$/.test(file))continue;
    const source=await readFile(resolve(project,'dist',file),'utf8');
    const refs=[...source.matchAll(/(?:from\s+['"]|(?:src|href)="|url\(')([^'"\s)]+)['"]/g)].map(match=>match[1]).filter(ref=>ref!=='#' && !ref.includes('${'));
    for(const ref of refs) {
      assert.ok(!ref.startsWith('/') && !ref.startsWith('http'),`Portable path: ${file} -> ${ref}`);
      const normalized=posix.normalize(posix.join(posix.dirname(file),ref.split('?')[0]));
      assert.ok(files.has(normalized),`Complete dependency: ${file} -> ${ref}`);
    }
    if(file.endsWith('.js'))assert.match(file,new RegExp(`\\.${release.version}\\.js$`));
    if(file.startsWith('resources.'))assert.ok(source.includes(`const ASSET_VERSION = '${release.version}'`));
  }
  assert.equal(files.has('README.md'),false); assert.equal(files.has('tests/browser.mjs'),false);
});
test('Release serves under a repository subpath with redirects, correct MIME, reload and MP3 ranges',async()=>{
  const server=createStaticServer(resolve(project,'dist'),'/rewind-tower/');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const redirect=await fetch(base+'/rewind-tower?test=1',{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),'/rewind-tower/?test=1');
    const response=await fetch(base+'/rewind-tower/');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/html/);
    const html=await response.text(),module=html.match(/src="(game\.[^"]+\.js)"/)[1];
    const js=await fetch(base+'/rewind-tower/'+module);assert.equal(js.status,200);assert.match(js.headers.get('content-type'),/javascript/);
    const audio=await fetch(base+'/rewind-tower/assets/sounds/bgm-menu.mp3',{headers:{Range:'bytes=0-255'}});assert.equal(audio.status,206);assert.equal((await audio.arrayBuffer()).byteLength,256);
    assert.equal((await fetch(base+'/game.js')).status,404);
    assert.equal((await fetch(base+'/rewind-tower/')).status,200);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
