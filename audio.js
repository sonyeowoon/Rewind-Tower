import { assetUrl } from './resources.js';

export class GameAudio {
  constructor() {
    this.settings = { muted: false, bgmVolume: .35, sfxVolume: .7 };
    this.unlocked = false; this.suspended = false; this.bgm = null; this.name = ''; this.effects = new Map(); this.timestamps = new Map(); this.timers = new Set(); this.ducked = false;
  }
  apply(settings) {
    this.settings = { muted: settings?.muted === true,
      bgmVolume: this.volume(settings?.bgmVolume, .35), sfxVolume: this.volume(settings?.sfxVolume, .7) };
    this.sync();
  }
  volume(v, fallback) { return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : fallback; }
  play(audio) {
    if (this.unlocked && !this.suspended && !this.settings.muted) {
      try { audio.play()?.catch(() => {}); } catch { /* Media failures must never stop a turn. */ }
    }
  }
  unlock() { this.unlocked = true; if (this.bgm?.paused) this.play(this.bgm); }
  suspend() { this.suspended = true; this.bgm?.pause(); this.effects.forEach(a => a.pause()); }
  resume() { this.suspended = false; this.sync(); }
  sync() {
    if (this.bgm) { this.bgm.volume = this.settings.bgmVolume * (this.ducked ? .25 : 1); this.bgm.muted = this.settings.muted; }
    this.effects.forEach(a => { a.muted = this.settings.muted; a.volume = this.settings.sfxVolume; });
    if (!this.settings.muted && this.bgm?.paused) this.play(this.bgm);
  }
  later(fn, ms) { const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms); this.timers.add(id); }
  cancelTimers() { this.timers.forEach(clearTimeout); this.timers.clear(); this.ducked = false; }
  change(name, loop = true) {
    this.cancelTimers(); this.effects.forEach(a => { a.pause(); a.currentTime = 0; });
    // Paired floors continue the same music, but must clear the previous floor's effects and ducking.
    if (this.name === name && this.bgm) { this.sync(); return; }
    if (this.bgm) { this.bgm.pause(); this.bgm.currentTime = 0; }
    this.name = name; this.bgm = name ? new Audio(assetUrl(`sounds/${name}.mp3`)) : null;
    if (this.bgm) { this.bgm.loop = loop; this.bgm.preload = 'auto'; this.sync(); this.play(this.bgm); }
  }
  sfx(name) {
    if (!this.unlocked || this.suspended || this.settings.muted) return;
    const now = performance.now();
    if (now - (this.timestamps.get(name) ?? -Infinity) < (name === 'ui-hover' ? 160 : 100)) return;
    this.timestamps.set(name, now);
    let effect = this.effects.get(name);
    if (!effect) { effect = new Audio(assetUrl(`sounds/${name}.mp3`)); effect.preload = 'auto'; this.effects.set(name, effect); }
    effect.pause(); effect.currentTime = 0; effect.volume = this.settings.sfxVolume; effect.muted = this.settings.muted; this.play(effect);
    if (name.startsWith('step-')) this.later(() => effect.pause(), 180);
  }
  stopSfx(name) { const effect = this.effects.get(name); if (effect) { effect.pause(); effect.currentTime = 0; } }
  duck() { this.ducked = true; this.sync(); this.later(() => { this.ducked = false; this.sync(); }, 1800); }
}
