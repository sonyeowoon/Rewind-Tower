import { stageById } from './stages.js';

export const DIRECTIONS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
export const SAVE_VERSION = 2;
const copy = value => JSON.parse(JSON.stringify(value));
const equal = (a, b) => a && b && a.row === b.row && a.col === b.col;
const count = (map, tile) => map.flat().filter(t => t === tile).length;
export function createGame(stageId) {
  const stage = stageById(stageId);
  if (!stage) throw new Error('Unknown stage');
  const mapData = copy(stage.map);
  let playerPosition;
  mapData.forEach((row, r) => row.forEach((tile, c) => {
    if (tile === 'P') { playerPosition = { row: r, col: c }; row[c] = '.'; }
  }));
  return { stageId, mapData, playerPosition, rewindPosition: null, rewindTrail: [], score: 1000,
    moveCount: 0, rewindCount: 0, rewindUsedCount: 0, collectedGearCount: 0,
    totalGearCount: count(mapData, 'G'), isExitOpen: false, keys: 0,
    direction: 'down', gameState: 'PLAYING', resultType: null };
}

// Pure transition: only this module changes puzzle state. A rewind never restores the map.
export function transition(current, action) {
  if (current.gameState !== 'PLAYING') return { state: current, events: [] };
  const s = copy(current), events = [];
  let rewindPath = null;
  const tileAt = p => s.mapData[p.row]?.[p.col];
  const leave = () => {
    if (tileAt(s.playerPosition) === 'F') {
      s.mapData[s.playerPosition.row][s.playerPosition.col] = 'O'; events.push('collapse');
    }
  };
  if (action === 'rewind') {
    if (!s.rewindCount || !s.rewindPosition || equal(s.playerPosition, s.rewindPosition))
      return { state: current, events: ['no-rewind'] };
    if (!['.', 'U'].includes(tileAt(s.rewindPosition))) return { state: current, events: ['no-rewind'] };
    // Preserve every turn and repeated visit, not a shortest path to the anchor.
    // These are presentation frames: they never trigger collisions or tile interactions.
    rewindPath = s.rewindTrail.slice(0, -1).reverse();
    leave(); s.playerPosition = { ...s.rewindPosition }; s.rewindCount--; s.rewindUsedCount++;
    s.rewindTrail = [{ ...s.rewindPosition }];
    events.push('rewind');
  } else {
    const delta = DIRECTIONS[action];
    if (!Object.hasOwn(DIRECTIONS, action)) return { state: current, events: [] };
    const p = { row: s.playerPosition.row + delta[0], col: s.playerPosition.col + delta[1] };
    const tile = tileAt(p);
    if (!tile || ['#', 'V', 'O'].includes(tile) || (tile === 'D' && !s.keys) || (tile === 'E' && !s.isExitOpen))
      return { state: current, events: [tile === 'D' ? 'need-key' : tile === 'E' ? 'need-gears' : 'blocked'] };
    leave(); s.direction = action; s.playerPosition = p; s.moveCount++; events.push('step');
    if (tile === 'G') { s.collectedGearCount++; events.push('gear'); }
    if (tile === 'H') {
      s.rewindCount = Math.min(3, s.rewindCount + 1); s.rewindPosition = { ...p }; events.push('hourglass');
      s.rewindTrail = [{ ...p }];
    } else if (s.rewindPosition) {
      s.rewindTrail.push({ ...p });
    }
    if (tile === 'K') { s.keys++; events.push('key'); }
    if (['G', 'H', 'K'].includes(tile)) s.mapData[p.row][p.col] = '.';
    if (tile === 'D') { s.keys--; s.mapData[p.row][p.col] = 'U'; events.push('unlock'); }
    if (tile === 'F') events.push('crack');
    if (!s.isExitOpen && s.collectedGearCount === s.totalGearCount) { s.isExitOpen = true; events.push('exit-open'); }
    if (tile === 'X' || tile === 'E') {
      s.gameState = 'GAME_OVER'; s.resultType = tile === 'E' ? 'WIN' : 'LOSE';
      events.push(tile === 'E' ? 'win' : 'lose');
    }
  }
  s.score = Math.max(0, 1000 + s.collectedGearCount * 100 - s.moveCount * 3 - s.rewindUsedCount * 50 + (s.resultType === 'WIN' ? 500 : 0));
  return { state: s, events, rewindPath };
}

export function buildSave(state, userId) {
  const { gameState, resultType, ...data } = state;
  return { ...data, version: SAVE_VERSION, userId, savedAt: new Date().toISOString() };
}

export function validateSave(data, userId, unlockedStage) {
  if (!data || data.version !== SAVE_VERSION || data.userId !== userId) return false;
  const stage = stageById(data.stageId);
  if (!stage || stage.id > unlockedStage || !Array.isArray(data.mapData)) return false;
  const m = data.mapData;
  if (m.length !== stage.map.length) return false;
  const allowed = { '#': ['#'], V: ['V'], '.': ['.'], P: ['.'], G: ['G', '.'], H: ['H', '.'], K: ['K', '.'], F: ['F', 'O'], D: ['D', 'U'], X: ['X'], E: ['E'] };
  for (let r = 0; r < m.length; r++) {
    if (!Array.isArray(m[r]) || m[r].length !== stage.map[r].length) return false;
    for (let c = 0; c < m[r].length; c++) if (!allowed[stage.map[r][c]].includes(m[r][c])) return false;
  }
  const validPosition = p => p && Number.isInteger(p.row) && Number.isInteger(p.col) && p.row >= 0 && p.col >= 0 && p.row < m.length && p.col < m[0].length;
  if (!validPosition(data.playerPosition) || !['.', 'F', 'U'].includes(m[data.playerPosition.row][data.playerPosition.col])) return false;
  if (data.rewindPosition !== null && (!validPosition(data.rewindPosition) || stage.map[data.rewindPosition.row][data.rewindPosition.col] !== 'H' || m[data.rewindPosition.row][data.rewindPosition.col] !== '.')) return false;
  const nums = ['score', 'moveCount', 'rewindCount', 'rewindUsedCount', 'collectedGearCount', 'totalGearCount', 'keys'];
  if (nums.some(k => !Number.isSafeInteger(data[k]) || data[k] < 0)) return false;
  if (data.rewindCount > 3 || typeof data.direction !== 'string' || !Object.hasOwn(DIRECTIONS, data.direction) || typeof data.isExitOpen !== 'boolean') return false;
  const acquiredHours = count(stage.map, 'H') - count(m, 'H');
  if (data.rewindCount + data.rewindUsedCount !== acquiredHours || (acquiredHours > 0) !== (data.rewindPosition !== null)) return false;
  if (!Array.isArray(data.rewindTrail) || data.rewindTrail.length > data.moveCount + 1) return false;
  if (data.rewindPosition === null) {
    if (data.rewindTrail.length !== 0) return false;
  } else {
    if (!equal(data.rewindTrail[0], data.rewindPosition) || !equal(data.rewindTrail.at(-1), data.playerPosition)) return false;
    for (let i = 0; i < data.rewindTrail.length; i++) {
      const p = data.rewindTrail[i], previous = data.rewindTrail[i - 1];
      if (!validPosition(p) || !['.', 'F', 'O', 'U'].includes(m[p.row][p.col])) return false;
      if (previous && Math.abs(p.row - previous.row) + Math.abs(p.col - previous.col) !== 1) return false;
    }
  }
  if (data.keys !== count(stage.map, 'K') - count(m, 'K') - count(m, 'U')) return false;
  if (data.totalGearCount !== count(stage.map, 'G') || data.collectedGearCount !== data.totalGearCount - count(m, 'G')) return false;
  if (data.isExitOpen !== (data.collectedGearCount === data.totalGearCount)) return false;
  if (data.score !== Math.max(0, 1000 + data.collectedGearCount * 100 - data.moveCount * 3 - data.rewindUsedCount * 50)) return false;
  if (typeof data.savedAt !== 'string' || !Number.isFinite(Date.parse(data.savedAt))) return false;
  return true;
}
