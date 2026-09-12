import { STAGES } from './stages.js';
export class LocalStore {
  constructor(onError = () => {}) { this.memory = new Map(); this.available = true; this.onError = onError; }
  fail() { if (this.available) { this.available = false; this.onError(); } }
  read(key, fallback = null) {
    let raw = this.memory.get(key);
    if (this.available) {
      try { raw = localStorage.getItem(key); if (raw !== null) this.memory.set(key, raw); }
      catch { this.fail(); }
    }
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch { return { corrupt: true }; }
  }
  write(key, value) {
    const raw = JSON.stringify(value); this.memory.set(key, raw);
    if (this.available) { try { localStorage.setItem(key, raw); } catch { this.fail(); } }
    return this.available;
  }
  remove(key) {
    this.memory.delete(key);
    if (this.available) { try { localStorage.removeItem(key); } catch { this.fail(); } }
    return this.available;
  }
}
export const normalizeNickname = name => name.trim().normalize('NFKC').toLowerCase();
export const validNickname = name => /^[\p{L}\p{N}_-]{2,12}$/u.test(name.trim().normalize('NFKC'));
export const validPin = pin => /^\d{4}$/.test(pin);
export async function hashPin(pin, salt) {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto를 사용할 수 없습니다. 최신 브라우저에서 localhost 또는 HTTPS 주소로 열어주세요.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 120000, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(bits)].map(n => n.toString(16).padStart(2, '0')).join('');
}
export function randomHex() { return [...crypto.getRandomValues(new Uint8Array(16))].map(n => n.toString(16).padStart(2, '0')).join(''); }
export function validAccounts(accounts) {
  if (!Array.isArray(accounts) || !accounts.every(a => a && /^[a-f0-9]{32}$/.test(a.id) && typeof a.nickname === 'string' && validNickname(a.nickname) && /^[a-f0-9]{32}$/.test(a.pinSalt) && /^[a-f0-9]{64}$/.test(a.pinHash))) return false;
  return new Set(accounts.map(a => a.id)).size === accounts.length && new Set(accounts.map(a => normalizeNickname(a.nickname))).size === accounts.length;
}
export function readProgress(raw) {
  const progress = { unlockedStage: 1, stageRecords: {} };
  if (!raw || typeof raw.stageRecords !== 'object' || !raw.stageRecords) return progress;
  for (let id = 1; id <= STAGES.length; id++) {
    const record = raw.stageRecords[id];
    if (!record || record.cleared !== true || !Number.isSafeInteger(record.bestScore) || record.bestScore < 0 || record.bestScore > 2200) break;
    progress.stageRecords[id] = { cleared: true, bestScore: record.bestScore };
    progress.unlockedStage = Math.min(STAGES.length, id + 1);
  }
  return progress;
}
