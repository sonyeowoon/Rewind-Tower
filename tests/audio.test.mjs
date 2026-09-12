import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../audio.js';

test('Paired stages preserve BGM position while cancelling stale effects and restoring volume', () => {
  const original = globalThis.Audio;
  globalThis.Audio = class {
    constructor(src) { this.src=src; this.paused=true; this.currentTime=0; }
    pause() { this.paused=true; }
    play() { this.paused=false; return Promise.resolve(); }
  };
  const audio=new GameAudio();
  try {
    audio.unlock(); audio.change('bgm-stage-1'); const track=audio.bgm;track.currentTime=42;
    audio.sfx('stage-clear'); const effect=audio.effects.get('stage-clear');
    audio.duck(); assert.ok(track.volume<audio.settings.bgmVolume);
    audio.change('bgm-stage-1');
    assert.equal(audio.bgm,track); assert.equal(track.currentTime,42);
    assert.equal(track.volume,audio.settings.bgmVolume); assert.equal(audio.timers.size,0);
    assert.equal(effect.paused,true); assert.equal(effect.currentTime,0);
    audio.change('bgm-stage-2'); assert.equal(track.paused,true);assert.notEqual(audio.bgm,track);
  } finally { audio.cancelTimers(); globalThis.Audio=original; }
});
