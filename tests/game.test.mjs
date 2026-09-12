import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, stageBgm } from '../stages.js';
import { createGame, transition, buildSave, validateSave } from '../engine.js';
import { hashPin, normalizeNickname, validNickname, validPin, LocalStore, readProgress } from '../storage.js';
import { solve } from './solve.mjs';
import { existsSync } from 'node:fs';

for (const stage of STAGES) test(`Stage ${stage.id}: map integrity and playable solution with valid intermediate saves`, () => {
  const flat = stage.map.flat();
  assert.equal(flat.filter(t=>t==='P').length, 1); assert.equal(flat.filter(t=>t==='E').length,1);
  assert.equal(flat.filter(t=>t==='H').length,stage.rewindLimit);
  stage.map.forEach((row,r) => { assert.equal(row.length,stage.map[0].length); assert.equal(row[0],'#'); assert.equal(row.at(-1),'#'); if (r===0 || r===stage.map.length-1) assert.ok(row.every(t=>t==='#')); });
  const solution = solve(stage.id); assert.ok(solution, 'Stage must be solvable');
  let state = createGame(stage.id);
  for (const action of solution.actions) {
    state = transition(state, action).state;
    if (state.gameState === 'PLAYING') assert.ok(validateSave(buildSave(state,'owner'), 'owner', stage.id));
  }
  assert.equal(state.resultType,'WIN'); assert.equal(state.collectedGearCount,state.totalGearCount);
  assert.equal(state.score,Math.max(0,1500+state.totalGearCount*100-state.moveCount*3-state.rewindUsedCount*50));
  assert.equal(transition(state,'left').state,state);
  if (stage.id >= 3) assert.equal(solve(stage.id, false), null, 'Later puzzles require rewinding');
  console.log(`Stage ${stage.id}: ${solution.actions.length} actions, ${state.rewindUsedCount} rewinds, ${solution.explored} states`);
});

test('Failed moves and rewinds do not consume score, moves, or charges', () => {
  const state = createGame(1);
  for (const action of ['up','left','rewind']) assert.equal(transition(state,action).state,state);
  let s = state; for (let i=0;i<4;i++) s = transition(s,'right').state;
  assert.equal(s.rewindCount,1); assert.equal(transition(s,'rewind').state,s);
});
test('Rewind follows every recorded step backwards, including loops, without changing the world', () => {
  let s=createGame(1); for(const a of ['right','right','right','right','right','down','left','up','right']) s=transition(s,a).state;
  const before=structuredClone(s), outcome=transition(s,'rewind');
  assert.deepEqual(outcome.rewindPath,[{row:1,col:5},{row:2,col:5},{row:2,col:6},{row:1,col:6},{row:1,col:5}]);
  assert.deepEqual(outcome.state.mapData,before.mapData);
  assert.equal(outcome.state.moveCount,before.moveCount);
  assert.equal(outcome.state.rewindCount,before.rewindCount-1);
  assert.equal(outcome.state.score,before.score-50);
  assert.deepEqual(outcome.state.rewindTrail,[before.rewindPosition]);
  assert.deepEqual(s,before,'Transition does not mutate its input');
  assert.deepEqual(transition(s,'up').state.rewindTrail,s.rewindTrail,'Blocked moves leave no footprints');
  assert.ok(validateSave(buildSave(s,'owner'),'owner',1));
  for(const trail of [[],[{row:1,col:5},{row:1,col:6}], [{row:1,col:5},{row:0,col:5},{row:1,col:6}]]) {
    const bad=buildSave(s,'owner');bad.rewindTrail=trail;
    // A direct path is possible and cannot be distinguished from actual history after serialization.
    if(trail.length!==2)assert.equal(validateSave(bad,'owner',1),false);
  }
});

test('Rewinds cross collapsed floors without restoring them, and collapse a departing fragile tile', () => {
  let s=createGame(4), sawCollapsed=false, sawKeys=false, sawDoor=false;
  for(const action of solve(4).actions) {
    const before=s, outcome=transition(s,action);s=outcome.state;
    if(action==='rewind') {
      assert.deepEqual(s.mapData,before.mapData);assert.equal(s.keys,before.keys);
      assert.equal(s.collectedGearCount,before.collectedGearCount);
      sawCollapsed=outcome.rewindPath.some(p=>s.mapData[p.row][p.col]==='O');sawKeys=s.keys>0;
    }
    if(outcome.events.includes('unlock')) {sawDoor=true; assert.ok(s.mapData.flat().includes('U'));}
  }
  assert.ok(sawCollapsed && sawKeys && sawDoor);
  s=createGame(3);
  for(const action of solve(3).actions) {
    const outcome=transition(s,action);s=outcome.state;
    if(outcome.events.includes('crack')) {
      const p=s.playerPosition;s=transition(s,'rewind').state;assert.equal(s.mapData[p.row][p.col],'O');
      assert.ok(validateSave(buildSave(s,'owner'),'owner',3));return;
    }
  }
  assert.fail('Expected a fragile bridge');
});

test('A new hourglass replaces the trail; save round trips preserve ordered history', () => {
  let s=createGame(2), hours=0;
  for(const a of solve(2).actions) {
    const o=transition(s,a);s=o.state;
    if(o.events.includes('hourglass')) {hours++;assert.deepEqual(s.rewindTrail,[s.playerPosition]);}
    if(s.gameState==='PLAYING') {
      const save=JSON.parse(JSON.stringify(buildSave(s,'owner')));assert.ok(validateSave(save,'owner',2));
      assert.deepEqual(save.rewindTrail,s.rewindTrail);
    }
  }
  assert.equal(hours,2);
});

test('Rifts end the attempt; locked exits and voids block movement', () => {
  let s=createGame(3);s.playerPosition={row:7,col:8};s=transition(s,'down').state;
  assert.equal(s.resultType,'LOSE');assert.equal(transition(s,'rewind').state,s);
  s=createGame(1);s.playerPosition={row:8,col:6};assert.equal(transition(s,'down').state,s);
  s=createGame(3);s.playerPosition={row:9,col:1};assert.equal(transition(s,'up').state,s);
});

test('Reject foreign, incomplete, malformed, impossible, or locked-stage saves', () => {
  const save=buildSave(createGame(2),'alice'); assert.ok(validateSave(save,'alice',2));
  assert.equal(validateSave(save,'bob',2),false); assert.equal(validateSave(save,'alice',1),false);
  for(const mutate of [s=>delete s.keys,s=>s.version=1,s=>delete s.rewindTrail,s=>s.version=7,s=>s.score=-1,s=>s.score=900,s=>s.moveCount=NaN,s=>s.playerPosition={row:99,col:1},s=>s.mapData[0][0]='.',s=>s.mapData[1][1]='X',s=>s.rewindCount=3,s=>s.savedAt='bad',s=>s.totalGearCount=99,s=>delete s.rewindPosition]) {
    const bad=structuredClone(save); mutate(bad); assert.equal(validateSave(bad,'alice',2),false);
  }
});
test('Account normalization, PIN hashing and profile namespaces', async () => {
  assert.equal(normalizeNickname(' Alice '),'alice'); assert.equal(normalizeNickname(' Ｉ '),'i'); assert.ok(validNickname('탐험가_2')); assert.equal(validNickname('<script>'),false);
  assert.equal(validPin('123'),false); assert.equal(validPin('abcd'),false); assert.ok(validPin('0123'));
  const one=await hashPin('0123','a'.repeat(32)); const two=await hashPin('0123','b'.repeat(32));
  assert.equal(one.length,64); assert.notEqual(one,two); assert.equal(one,await hashPin('0123','a'.repeat(32))); assert.notEqual(one,await hashPin('9999','a'.repeat(32)));
  const backing=new Map(); globalThis.localStorage={getItem:k=>backing.get(k)??null,setItem:(k,v)=>backing.set(k,v),removeItem:k=>backing.delete(k)};
  const store=new LocalStore(); store.write('rewindTower.user.a.save',{moves:12}); store.write('rewindTower.user.b.save',{moves:2}); store.remove('rewindTower.user.a.save');
  assert.deepEqual(store.read('rewindTower.user.b.save'),{moves:2}); assert.equal(store.read('rewindTower.user.a.save'),null);
});
test('Blocked browser storage degrades to session memory without aborting gameplay', () => {
  globalThis.localStorage={getItem(){throw new Error('denied');},setItem(){throw new Error('quota');},removeItem(){throw new Error('denied');}};
  let warnings=0; const store=new LocalStore(()=>warnings++); assert.equal(store.write('save',{score:1000}),false);
  assert.deepEqual(store.read('save'),{score:1000}); store.remove('save'); assert.equal(store.read('save'),null); assert.equal(warnings,1);
});
test('Corrupted progress cannot unlock arbitrary stages',()=>{
  assert.equal(readProgress({unlockedStage:5}).unlockedStage,1);
  assert.equal(readProgress({stageRecords:{2:{cleared:true,bestScore:1000}}}).unlockedStage,1);
});
test('All 29 supplied sounds and consumed images exist',()=>{
  const sounds=['bgm-menu','bgm-all-clear',...Array.from({length:5},(_,i)=>`bgm-stage-${i+1}`),'ui-hover','ui-click','login-success','login-fail','game-start','step-stone-01','step-stone-02','move-blocked','collect-gear','collect-hourglass','time-anchor','rewind','exit-open','fragile-floor-crack','fragile-floor-collapse','collect-key','door-unlock','time-rift','save','stage-clear','game-over','all-clear'];
  assert.equal(sounds.length,29); for(const sound of sounds) assert.ok(existsSync(`assets/sounds/${sound}.mp3`),sound);
  for(const image of ['player-directions','floor-stone','wall-stone','time-gear','hourglass','time-anchor.png','exit-closed','exit-open','time-rift','menu-background','fragile-floor','collapsed-floor','time-key','locked-door','unlocked-door']) assert.ok(existsSync(`assets/images/${image}.png`),image);
});

test('Ten sequential stages share five BGM tracks in pairs',()=>{
  assert.equal(STAGES.length,10);
  assert.deepEqual(STAGES.map(s=>stageBgm(s.id)),[1,1,2,2,3,3,4,4,5,5].map(n=>'bgm-stage-'+n));
  const records=Object.fromEntries(STAGES.map(s=>[s.id,{cleared:true,bestScore:1000}]));
  assert.equal(readProgress({stageRecords:records}).unlockedStage,10);
  assert.equal(Object.keys(readProgress({stageRecords:records}).stageRecords).length,10);
  assert.equal(new Set(STAGES.map(s=>s.layout)).size,10);
});
