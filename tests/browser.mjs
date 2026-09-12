// Optional developer test: use an installed Playwright package (no runtime dependency).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { STAGES, stageBgm } from '../stages.js';
import { solve } from './solve.mjs';
import { createStaticServer } from '../scripts/static-server.mjs';
import { resolve } from 'node:path';
const server=process.env.TEST_DIST ? createStaticServer(resolve('dist'),'/rewind-tower/') : null;
if(server) await new Promise(done=>server.listen(0,'127.0.0.1',done));
const gameUrl=server ? `http://127.0.0.1:${server.address().port}/rewind-tower/` : (process.env.GAME_URL || 'http://localhost:4173');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true, channel:process.env.BROWSER_CHANNEL || 'chrome'});
const context = await browser.newContext({ viewport:{width:1440,height:1000}, reducedMotion:'reduce' });
await context.addInitScript(()=>{const NativeAudio=window.Audio;window.__audio=[];window.Audio=function(src){const instance=new NativeAudio(src);window.__audio.push(instance);return instance;};});
const page = await context.newPage(); const errors=[], failed=[];
page.on('pageerror', e=>errors.push(e.message));
page.on('response', r=>{if(r.status()>=400) failed.push(`${r.status()} ${r.url()}`);});
await mkdir('tests/artifacts',{recursive:true});
const snapshot = name => page.screenshot({path:`tests/artifacts/${name}.png`, fullPage:true});
const click = id => page.locator('#'+id).click();
async function fillAuth(name,pin,creating=false) {
  await page.locator('#nickname').fill(name); await page.locator('#pin').fill(pin);
  if(creating) await page.locator('#pin-confirm').fill(pin);
  await click('auth-submit');
  await page.waitForFunction(()=>!document.getElementById('auth-submit').disabled);
}
async function saved() { return page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.endsWith('.save'));if(!key)return null;const {savedAt,...state}=JSON.parse(localStorage.getItem(key));return state;}); }
const keyFor={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',rewind:'r'};
async function move(action) { await page.keyboard.press(keyFor[action]); await page.waitForTimeout(155); if(action==='rewind') await page.waitForFunction(()=>document.getElementById('board').dataset.rewinding!=='true'); }
try {
  await page.goto(gameUrl); await page.waitForLoadState('networkidle'); await snapshot('01-login-desktop');
  await fillAuth('테스트탐험가','0123',true); await page.locator('#main-screen').waitFor({state:'visible'}); await snapshot('02-main-desktop');
  await click('stages-button'); assert.equal(await page.locator('.stage-card:disabled').count(),9); await snapshot('03-stages-desktop');
  await page.locator('[data-action=main]').filter({visible:true}).first().click(); await click('new-game-button');
  assert.equal(await page.locator('#tutorial').isVisible(),true);
  await move('right'); await click('tutorial-next'); await move('right'); await click('tutorial-next');
  await move('right'); await move('right'); await click('tutorial-next'); await move('right'); await move('rewind');
  await click('tutorial-next'); await click('tutorial-next'); assert.equal(await page.locator('#tutorial').isVisible(),false);
  await snapshot('04-game-desktop');
  const beforeHelp=await saved(); await click('help-button'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Escape'); assert.deepEqual(await saved(),beforeHelp);
  await page.reload(); await page.locator('#login-screen').waitFor({state:'visible'}); await fillAuth('테스트탐험가','9999');
  assert.match(await page.locator('#auth-error').innerText(),/닉네임 또는 PIN/); await fillAuth('테스트탐험가','0123'); await click('continue-button');
  assert.equal(await page.locator('#tutorial').isVisible(),false); assert.deepEqual(await saved(),beforeHelp);
  await page.setViewportSize({width:360,height:800}); await snapshot('05-game-mobile');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const moveBefore=(await saved()).moveCount; await page.locator('[data-move=down]').click(); await page.waitForTimeout(170); assert.equal((await saved()).moveCount,moveBefore+1);
  await page.setViewportSize({width:1366,height:768}); await snapshot('09-game-laptop');
  const boardBox=await page.locator('#board').boundingBox(),controlBox=await page.locator('#rewind-button').boundingBox();
  assert.ok(boardBox.y+boardBox.height<=768);assert.ok(controlBox.y+controlBox.height<=768);
  await page.setViewportSize({width:1440,height:1000}); await click('restart-button'); await click('confirm-yes');
  for(let id=1;id<=STAGES.length;id++) {
    const solution=solve(id);
    assert.ok(await page.evaluate(()=>window.__audio.filter(a=>a.loop&&!a.paused).length<=1),'Only one background track may play');
    await snapshot('floor-'+id+'-desktop');
    assert.ok(await page.evaluate(track=>window.__audio.some(a=>a.src.includes(track)),stageBgm(id)));
    if([3,6,8,10].includes(id)) {
      await page.setViewportSize({width:360,height:800});await snapshot('floor-'+id+'-mobile');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await click('map-zoom');assert.equal(await page.locator('#map-zoom').getAttribute('aria-pressed'),'true');
      assert.ok(await page.evaluate(()=>document.getElementById('board').scrollWidth>document.getElementById('board-viewport').clientWidth));
      await click('map-zoom');await page.setViewportSize({width:1440,height:1000});
    }
    for(const action of solution.actions) await move(action);
    await page.locator('#result-retry').waitFor({state:'visible'}); assert.equal(await saved(),null);
    assert.equal(await page.locator('#hud-score').innerText(),solution.state.score.toLocaleString('ko-KR'));
    const records=await page.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.endsWith('.progress')))));
    assert.equal(records.unlockedStage,Math.min(STAGES.length,id+1));
    console.log(`Browser: floor ${id} completed, ${solution.actions.length} real keyboard actions`);
    if(id<STAGES.length) await click('next-stage');
  }
  await click('next-stage'); await snapshot('06-all-clear-desktop'); await page.locator('#modal [data-action=main]').click();
  await click('stages-button');await page.locator('[data-stage="3"]').click();
  for(const action of ['right','right','up','up','right','right','right','right','down'])await move(action);
  assert.match(await page.locator('#modal-title').innerText(),/균열/);assert.equal(await saved(),null);
  await page.locator('#modal [data-action=main]').click();
  await click('logout-button'); await click('auth-toggle'); await fillAuth('두번째탐험가','9876',true);
  assert.equal(await page.locator('#continue-button').isDisabled(),true); assert.match(await page.locator('#unlocked-count').innerText(),/^1/);
  await click('mute-button'); await click('new-game-button'); assert.equal(await page.locator('#tutorial').isVisible(),true); await click('tutorial-skip'); await move('right');
  const bSave=await saved(); assert.ok(bSave);
  await click('logout-button'); await fillAuth('테스트탐험가','0123'); assert.match(await page.locator('#unlocked-count').innerText(),/^10/); assert.equal(await page.locator('#continue-button').isDisabled(),true);
  await click('settings-button'); await click('delete-account'); await page.locator('#delete-pin').fill('1111'); await page.locator('#delete-agree').check(); await click('delete-submit');
  await page.waitForTimeout(150); assert.match(await page.locator('#delete-error').innerText(),/PIN/);
  await page.locator('#delete-pin').fill('0123'); await click('delete-submit'); await page.locator('#login-screen').waitFor({state:'visible'});
  await fillAuth('두번째탐험가','9876'); assert.equal(await page.locator('#continue-button').isDisabled(),false); assert.equal(await page.locator('#mute-button').getAttribute('aria-pressed'),'true');
  await click('continue-button'); assert.deepEqual(await saved(),bSave);
  await page.locator('#game-screen [data-action=main]').click(); await click('logout-button');
  await page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.endsWith('.save'));localStorage.setItem(key,'{bad-json');});
  await fillAuth('두번째탐험가','9876'); assert.equal(await page.locator('#continue-button').isDisabled(),true);
  await page.setViewportSize({width:360,height:800}); await click('help-button'); await snapshot('07-help-mobile');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]); assert.deepEqual(failed,[]);
  assert.deepEqual(await page.evaluate(()=>window.__audio.filter(a=>a.error).map(a=>a.src)),[]);
  console.log(`PASS (${server?'production subpath':'source'}): tutorial, input lock, reload/login/resume, mobile touch, ten wins, rift loss, sequential unlocks, two accounts, mute persistence, PIN deletion, corrupt save, no console or media/resource errors.`);
} finally { await browser.close(); if(server) await new Promise(done=>server.close(done)); }
