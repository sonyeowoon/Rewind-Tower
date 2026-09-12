// Exercise animation ordering and interrupted playback against the actual production modules.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createStaticServer } from '../scripts/static-server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = createStaticServer(resolve('dist'), '/replay/');
await new Promise(done => server.listen(0, '127.0.0.1', done));
const url = `http://127.0.0.1:${server.address().port}/replay/`;
const browser = await chromium.launch({ headless:true, channel:process.env.BROWSER_CHANNEL || 'chrome' });
try {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ reducedMotion });
    const page = await context.newPage(), errors=[];
    page.on('pageerror', error => errors.push(error.message));
    const click = id => page.locator('#'+id).click();
    const saved = () => page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.endsWith('.save'))));
      const { savedAt,...state } = raw; return state;
    });
    const login = async (creating=false) => {
      await page.locator('#nickname').fill('발자국검증'); await page.locator('#pin').fill('0123');
      if (creating) await page.locator('#pin-confirm').fill('0123');
      await click('auth-submit'); await page.locator('#main-screen').waitFor({state:'visible'});
    };
    const move = async key => { await page.keyboard.press(key); await page.waitForTimeout(160); };
    const loop = async () => {
      for (const key of ['ArrowRight','ArrowRight','ArrowRight','ArrowRight','ArrowRight','ArrowDown','ArrowLeft','ArrowUp','ArrowRight']) await move(key);
    };
    const awaitPlayback = () => page.waitForFunction(() => document.getElementById('board').dataset.rewinding === 'false');
    await page.goto(url); await login(true); await click('new-game-button'); await click('tutorial-skip');
    await loop(); const before = await saved();
    await page.evaluate(() => {
      const player=document.getElementById('player'); window.__footsteps=[];
      window.__observer=new MutationObserver(() => {
        const point=[Number(player.dataset.row),Number(player.dataset.col)];
        if(JSON.stringify(window.__footsteps.at(-1))!==JSON.stringify(point))window.__footsteps.push(point);
      });
      window.__observer.observe(player,{attributes:true,attributeFilter:['data-row','data-col']});
    });
    await page.keyboard.press('r');
    assert.equal(await page.locator('#board').getAttribute('data-rewinding'),'true');
    const settled = await saved();
    assert.deepEqual(settled.playerPosition,before.rewindPosition);
    assert.equal(settled.rewindUsedCount,1); assert.equal(settled.moveCount,before.moveCount);
    await page.keyboard.press('r'); await page.keyboard.press('ArrowDown');
    await click('save-button'); assert.deepEqual(await saved(),settled);
    await awaitPlayback();
    const frames=await page.evaluate(() => {window.__observer.disconnect();return window.__footsteps;});
    // The departure is deliberately re-committed before the first hop.
    if(JSON.stringify(frames[0])===JSON.stringify([1,6])) frames.shift();
    assert.deepEqual(frames,[[1,5],[2,5],[2,6],[1,6],[1,5]],'Every visit, including repeated coordinates, is replayed backwards');
    assert.deepEqual(await saved(),settled);
    assert.equal(await page.locator('[data-move=down]').isEnabled(),true);
    await move('ArrowDown'); assert.equal((await saved()).moveCount,settled.moveCount+1);
    // Navigate out during replay; stale timers must never move a replacement player.
    await click('restart-button'); await click('confirm-yes'); await loop(); await page.keyboard.press('r');
    await page.locator('#game-screen [data-action=main]').click(); await click('continue-button');
    const resumed = await saved(); await page.waitForTimeout(900);
    assert.equal(await page.locator('#player').getAttribute('data-row'),String(resumed.playerPosition.row));
    assert.equal(await page.locator('#player').getAttribute('data-col'),String(resumed.playerPosition.col));
    assert.equal(await page.locator('[data-move=down]').isEnabled(),true);
    // Reload during replay; load the committed anchor with one spent charge, not a partial frame.
    await click('restart-button'); await click('confirm-yes'); await loop(); await page.keyboard.press('r');
    const beforeReload=await saved(); await page.reload(); await login(); await click('continue-button');
    assert.deepEqual(await saved(),beforeReload);
    assert.equal(await page.locator('#board').getAttribute('data-rewinding'),'false');
    assert.equal(await page.locator('#player').getAttribute('data-col'),'5');
    assert.deepEqual(errors,[]); await context.close();
    console.log(`PASS (${reducedMotion}): exact repeated route, locked input, atomic save, navigation cancellation, reload during replay.`);
  }
} finally { await browser.close(); await new Promise(done => server.close(done)); }
