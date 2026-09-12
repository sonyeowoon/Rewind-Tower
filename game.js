import { STAGES, stageById, stageBgm } from './stages.js';
import { createGame, transition, buildSave, validateSave } from './engine.js';
import { LocalStore, normalizeNickname, validNickname, validPin, hashPin, randomHex, validAccounts, readProgress } from './storage.js';
import { GameAudio } from './audio.js';
import { assetUrl } from './resources.js';

const $ = id => document.getElementById(id);
const audio = new GameAudio();
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3300); }
const store = new LocalStore(() => { $('storage-warning').hidden = false; toast('브라우저 저장을 사용할 수 없습니다. 이번 창에서만 플레이 기록이 유지됩니다.'); });
const ACCOUNT_KEY = 'rewindTower.accounts';
let user = null, progress = null, game = null, screen = 'LOGIN', authMode = 'login', authBusy = false;
let tutorial = null, lastInput = 0, inputLockedUntil = 0, corruptSaveNotified = false;
let rewindPlayback = null;
const userKey = type => `rewindTower.user.${user.id}.${type}`;
const format = n => n.toLocaleString('ko-KR');
const totalBest = () => Object.values(progress.stageRecords).reduce((sum, record) => sum + record.bestScore, 0);

function showScreen(next) {
  cancelRewindPlayback();
  screen = next;
  for (const id of ['login','main','stage','game']) $(id + '-screen').hidden = id !== ({ LOGIN:'login', MAIN:'main', STAGE_SELECT:'stage', GAME:'game' }[next]);
  $('profile-name').textContent = user ? `${user.nickname} 님` : '';
  $('logout-button').hidden = !user;
  document.body.dataset.screen = next;
  if (next !== 'GAME') { tutorial = null; inputLockedUntil = 0; audio.change('bgm-menu'); }
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function getSave() {
  if (!user) return null;
  const data = store.read(userKey('save'));
  if (data == null) return null;
  if (validateSave(data, user.id, progress.unlockedStage)) return data;
  if (!corruptSaveNotified) { toast('이어서 할 기록이 손상되었거나 버전이 다릅니다. 새 게임을 시작하세요.'); corruptSaveNotified = true; }
  return null;
}
function persistGame(manual = false) {
  if (!user || !game || game.gameState !== 'PLAYING') return false;
  const data = buildSave(game, user.id), success = store.write(userKey('save'), data);
  $('save-status').textContent = success ? `${manual ? '기록' : '자동'} 저장됨 · ${new Date(data.savedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : '이번 창에만 기록됨';
  if (manual) { toast(success ? '저장되었습니다.' : '저장할 수 없습니다. 창을 닫으면 진행이 사라집니다.'); if (success) audio.sfx('save'); }
  return success;
}
function showMain() {
  if (!user) return;
  if (screen === 'GAME') persistGame();
  closeModal(); showScreen('MAIN');
  $('welcome-name').textContent = user.nickname;
  $('unlocked-count').innerHTML = `${progress.unlockedStage} <em>/ ${STAGES.length}</em>`;
  $('total-score').textContent = format(totalBest());
  $('journey').innerHTML = STAGES.map((stage, i) => `${i ? '<i></i>' : ''}<span class="${stage.id > progress.unlockedStage ? 'locked' : ''}">${progress.stageRecords[stage.id]?.cleared ? '✓' : String(stage.id).padStart(2,'0')}</span>`).join('');
  const save = getSave(); $('continue-button').disabled = !save;
  $('save-description').textContent = save ? `${save.stageId}층 · ${stageById(save.stageId).name} · ${new Date(save.savedAt).toLocaleString('ko-KR', { month:'short',day:'numeric',hour:'2-digit',minute:'2-digit' })}` : '저장된 게임 없음 · 새로운 모험을 시작하세요';
}
function showStages() {
  if (!user) return;
  if (screen === 'GAME') persistGame();
  closeModal(); showScreen('STAGE_SELECT');
  const save = getSave();
  $('stage-cards').innerHTML = STAGES.map((stage, i) => {
    const locked = stage.id > progress.unlockedStage, record = progress.stageRecords[stage.id];
    const preview = `<span class="stage-map" style="--cols:${stage.map[0].length};--rows:${stage.map.length}" aria-hidden="true">${stage.map.flat().map(tile => `<i class="mini-${tile === '#' ? 'wall' : tile === '.' ? 'floor' : tile}"></i>`).join('')}</span>`;
    return `<button class="stage-card" data-stage="${stage.id}" ${locked ? 'disabled' : ''}><span class="card-floor">FLOOR ${String(stage.id).padStart(2,'0')}</span>${preview}<span class="layout-label">${stage.layout}</span><h3>${stage.name}</h3><p>${stage.description}</p><div class="card-status"><span>${locked ? '이전 층을 완료하세요' : save?.stageId === stage.id ? '● 진행 중' : record ? '✓ 클리어' : '탐험 가능'}</span><span>${record ? format(record.bestScore) : locked ? '◇' : '→'}</span></div></button>`;
  }).join('');
  resolveImages($('stage-cards'));
}
function requestStart(stageId, forceTutorial = false) {
  if (!user || stageId > progress.unlockedStage || !stageById(stageId)) return;
  const existing = getSave();
  if (existing && !forceTutorial && existing.stageId === stageId) {
    openModal('기록이 남아 있습니다', `<p>이 층의 진행을 이어가거나 처음부터 다시 시작할 수 있습니다. 새로 시작하면 현재 임시 기록이 교체됩니다.</p><div class="modal-actions"><button id="resume-choice" class="primary wide">이어하기 →</button><button id="fresh-choice" class="secondary wide">처음부터 시작</button></div>`);
    $('resume-choice').onclick = continueGame; $('fresh-choice').onclick = () => startStage(stageId); return;
  }
  if (existing) { confirmAction('새로운 탐험을 시작할까요?', '진행 중인 임시 기록이 교체됩니다. 해금한 층과 최고 점수는 유지됩니다.', () => startStage(stageId, forceTutorial)); return; }
  startStage(stageId, forceTutorial);
}
function startStage(stageId, forceTutorial = false) {
  if (!user || stageId > progress.unlockedStage || !stageById(stageId)) return;
  closeModal(); game = createGame(stageId); tutorial = null; showScreen('GAME'); inputLockedUntil = 0; lastInput = 0;
  audio.change(stageBgm(stageId)); audio.sfx('game-start');
  if (stageId === 1 && (forceTutorial || store.read(userKey('tutorial')) !== true)) tutorial = { step: 0, done: false };
  setupBoard(); renderGame(); renderTutorial(); persistGame();
  $('game-message').textContent = stageById(stageId).hint;
}
function continueGame() {
  const save = getSave(); if (!save) { showMain(); return; }
  closeModal(); const { version, userId, savedAt, ...data } = save;
  game = { ...data, gameState:'PLAYING', resultType:null }; tutorial = null; showScreen('GAME'); inputLockedUntil = 0; lastInput = 0;
  audio.change(stageBgm(game.stageId)); setupBoard(); renderGame(); renderTutorial();
  $('game-message').textContent = '기록을 불러왔습니다. 멈췄던 곳에서 모험을 이어가세요.';
  $('save-status').textContent = '저장 기록 복원됨';
}

const tileInfo = {
  G:['time-gear.png','시간 톱니','⚙'], H:['hourglass.png','모래시계','⌛'], K:['time-key.png','시간 열쇠','⚿'],
  D:['locked-door.png','잠긴 문','▣'], U:['unlocked-door.png','열린 문','▢'], E:['exit-closed.png','출구','⇥'],
};
function setupBoard() {
  cancelRewindPlayback();
  const board = $('board'); board.replaceChildren();
  board.style.setProperty('--cols', game.mapData[0].length);
  board.style.setProperty('--rows', game.mapData.length);
  $('game-screen').style.setProperty('--board-ratio', game.mapData[0].length / game.mapData.length);
  board.dataset.theme = stageById(game.stageId).theme;
  board.classList.remove('zoomed'); $('map-zoom').setAttribute('aria-pressed', 'false');
  $('map-zoom').textContent = '맵 확대 ＋';
  for (let r = 0; r < game.mapData.length; r++) for (let c = 0; c < game.mapData[r].length; c++) {
    const el = document.createElement('div'); el.className = 'tile'; el.dataset.row = r; el.dataset.col = c; board.append(el);
  }
  const player = document.createElement('div'); player.id = 'player'; player.className = 'player'; player.innerHTML = '<div class="player-sprite"></div>'; board.append(player);
}
function renderGame() {
  const stage = stageById(game.stageId);
  $('stage-subtitle').textContent = stage.subtitle; $('stage-number').textContent = String(stage.id).padStart(2,'0'); $('stage-name').textContent = stage.name;
  $('hud-score').textContent = format(game.score); $('hud-gears').textContent = `${game.collectedGearCount} / ${game.totalGearCount}`;
  $('hud-rewinds').textContent = game.rewindCount; $('hud-moves').textContent = game.moveCount;
  $('objective-title').textContent = game.isExitOpen ? '출구가 열렸습니다' : '흩어진 시간을 모으세요';
  $('objective-text').textContent = game.isExitOpen ? '청록빛 출구로 향하세요. 다음 층의 시간이 기다립니다.' : stage.hint;
  $('gear-progress').style.width = `${game.collectedGearCount / game.totalGearCount * 100}%`;
  $('exit-status').textContent = game.isExitOpen ? '출구 열림 ↗' : '출구 잠김'; $('key-status').textContent = `열쇠 ${game.keys}`;
  const anchor = game.rewindPosition;
  document.querySelectorAll('#board .tile').forEach(el => {
    const r = Number(el.dataset.row), c = Number(el.dataset.col), tile = game.mapData[r][c];
    const signature = `${tile}-${game.isExitOpen}-${anchor?.row === r && anchor?.col === c}`;
    if (el.dataset.signature === signature) return;
    el.dataset.signature = signature;
    el.className = 'tile ' + ({'#':'wall',V:'void',F:'fragile',O:'collapsed',X:'rift'}[tile] || '') + (anchor?.row === r && anchor?.col === c ? ' anchor' : '');
    el.replaceChildren();
    let info = tileInfo[tile];
    if (tile === 'E' && game.isExitOpen) info = ['exit-open.png','열린 출구','⇥'];
    if (info) {
      const fallback = document.createElement('span'); fallback.className = 'fallback'; fallback.textContent = info[2]; el.append(fallback);
      const img = document.createElement('img'); img.alt = info[1]; img.src = assetUrl('images/' + info[0]); img.className = ['D','U','E'].includes(tile) ? 'gate' : 'item';
      img.onerror = () => { img.className = 'failed'; img.hidden = true; }; el.append(img);
    }
    if (anchor?.row === r && anchor?.col === c) {
      const image = document.createElement('img'); image.src = assetUrl('images/time-anchor.png.png'); image.alt = '시간 기준점'; image.onerror = () => { image.hidden = true; }; el.prepend(image);
    }
    el.title = `${r}행 ${c}열 · ${info?.[1] || ({'#':'벽',V:'심연','.':'바닥',F:'무너지는 발판',O:'무너진 발판',X:'시간 균열'}[tile])}`;
  });
  if (!rewindPlayback) positionPlayer(game.playerPosition, game.direction);
  $('board').setAttribute('aria-label', `${stage.name}. 플레이어 ${game.playerPosition.row}행 ${game.playerPosition.col}열, 톱니 ${game.collectedGearCount}/${game.totalGearCount}, 되감기 ${game.rewindCount}회.`);
  $('position-label').textContent = `${String(game.playerPosition.col).padStart(2,'0')} : ${String(game.playerPosition.row).padStart(2,'0')}`;
  $('rewind-button').disabled = !!rewindPlayback || game.gameState !== 'PLAYING' || !game.rewindCount || (anchor?.row === game.playerPosition.row && anchor?.col === game.playerPosition.col);
  $('save-button').disabled = game.gameState !== 'PLAYING';
}

function positionPlayer(p, direction) {
  const player = $('player'); if (!player || !game) return;
  player.style.left = `${p.col / game.mapData[0].length * 100}%`;
  player.style.top = `${p.row / game.mapData.length * 100}%`;
  player.dataset.row = p.row; player.dataset.col = p.col; player.dataset.direction = direction;
  $('position-label').textContent = `${String(p.col).padStart(2,'0')} : ${String(p.row).padStart(2,'0')}`;
  if ($('board').classList.contains('zoomed')) {
    const viewport = $('board-viewport');
    viewport.scrollTo({ left:player.offsetLeft - viewport.clientWidth / 2 + player.offsetWidth / 2, top:player.offsetTop - viewport.clientHeight / 2 + player.offsetHeight / 2, behavior:'instant' });
  }
}
function cancelRewindPlayback() {
  if (rewindPlayback) clearTimeout(rewindPlayback.timer);
  rewindPlayback = null; inputLockedUntil = 0;
  $('board').dataset.rewinding = 'false';
  $('player')?.classList.remove('rewinding');
  $('player')?.style.removeProperty('transition-duration');
  document.querySelectorAll('.rewind-route,.rewind-echo').forEach(tile => tile.classList.remove('rewind-route','rewind-echo'));
  document.querySelectorAll('[data-move]').forEach(button => { button.disabled = false; });
}
function playRewind(path, origin) {
  if (!path?.length) return;
  const stepMs = Math.max(20, Math.min(110, 2600 / path.length));
  const playback = { timer:null, index:0, previous:origin };
  rewindPlayback = playback; inputLockedUntil = Infinity;
  $('board').dataset.rewinding = 'true';
  const player = $('player'); player.classList.add('rewinding');
  player.style.transitionDuration = '0ms'; positionPlayer(origin, game.direction);
  // Commit the departure position before animating; the saved game already contains the final state.
  void player.offsetWidth;
  player.style.transitionDuration = `${stepMs}ms`;
  for (const p of path) $('board').querySelector(`[data-row="${p.row}"][data-col="${p.col}"].tile`)?.classList.add('rewind-route');
  $('game-message').textContent = `지나온 ${path.length}걸음을 역순으로 되감는 중…`;
  renderTutorial(); $('rewind-button').disabled = true;
  document.querySelectorAll('[data-move]').forEach(button => { button.disabled = true; });
  const tick = () => {
    if (rewindPlayback !== playback) return;
    if (playback.index === path.length) {
      cancelRewindPlayback(); renderGame(); renderTutorial();
      $('game-message').textContent = '지나온 길을 되감았습니다. 수집한 아이템과 바뀐 지형은 그대로입니다.';
      return;
    }
    const p = path[playback.index++], from = playback.previous;
    const direction = p.row < from.row ? 'down' : p.row > from.row ? 'up' : p.col < from.col ? 'right' : 'left';
    $('board').querySelector(`[data-row="${from.row}"][data-col="${from.col}"].tile`)?.classList.add('rewind-echo');
    positionPlayer(p, direction); playback.previous = p;
    playback.timer = setTimeout(tick, stepMs);
  };
  playback.timer = setTimeout(tick, stepMs);
}

const lessons = [
  ['첫 걸음을 내디뎌 보세요','방향키, WASD 또는 화면의 화살표로 한 칸 이동하세요.','step'],
  ['빛나는 톱니바퀴를 찾아요','황금빛 톱니바퀴에 닿으면 수집됩니다. 입구 오른쪽에서 첫 톱니를 찾아보세요.','gear'],
  ['돌아갈 순간을 기억해요','위쪽 길의 모래시계를 얻으세요. 되감기 1회와 청록빛 기준점이 생깁니다.','hourglass'],
  ['시간을 되감아 보세요','기준점에서 이동한 뒤 R을 누르세요. 지나온 길을 역순으로 돌아갑니다. 톱니는 그대로 남습니다.','rewind'],
  ['이제 당신의 모험입니다','모든 톱니를 모은 뒤 열린 출구에 도착하세요. 이동은 -3점, 되감기는 -50점입니다.',null],
];
function renderTutorial() {
  $('tutorial').hidden = !tutorial;
  document.querySelector('.dpad').classList.remove('highlight'); $('rewind-button').classList.remove('highlight');
  if (!tutorial) return;
  const [title,text] = lessons[tutorial.step];
  $('tutorial-counter').textContent = `첫 번째 시간 · ${tutorial.step + 1} / 5`;
  $('tutorial-title').textContent = title; $('tutorial-text').textContent = tutorial.done ? '잘하셨어요. 다음을 눌러 다음 안내를 확인하세요.' : text;
  $('tutorial-next').disabled = !!rewindPlayback || (!tutorial.done && tutorial.step !== 4);
  $('tutorial-next').textContent = tutorial.step === 4 ? '탐험 시작 →' : '다음 →';
  if (!tutorial.done && tutorial.step < 4) (tutorial.step === 3 ? $('rewind-button') : document.querySelector('.dpad')).classList.add('highlight');
}
function finishTutorial() { tutorial = null; store.write(userKey('tutorial'), true); renderTutorial(); }
function input(action) {
  if (!user || screen !== 'GAME' || !game || game.gameState !== 'PLAYING' || $('modal').open) return;
  const now = performance.now(); if (now < inputLockedUntil || now - lastInput < 140) return; lastInput = now;
  if (tutorial && (tutorial.done || tutorial.step === 4)) { $('game-message').textContent = '안내 카드에서 다음을 눌러주세요.'; return; }
  if (tutorial && action === 'rewind' && tutorial.step !== 3) return;
  const origin = { ...game.playerPosition };
  const outcome = transition(game, action);
  if (tutorial && tutorial.step < 3 && outcome.events.some(e => ['hourglass','gear'].includes(e) && e !== lessons[tutorial.step][2])) {
    $('game-message').textContent = '지금 안내된 행동부터 해보세요. 자유롭게 탐험하려면 건너뛰기를 누르세요.'; return;
  }
  game = outcome.state;
  const messages = { gear:'시간 톱니를 모았습니다. +100점',hourglass:'이 순간을 기억합니다. 되감기 +1 · 기준점 생성',key:'시간 열쇠를 얻었습니다. 되감아도 열쇠는 남습니다.',unlock:'열쇠로 작업실 문을 열었습니다.',crack:'발판이 갈라집니다. 떠나면 다시 건널 수 없습니다.',collapse:'지나온 발판이 무너졌습니다.',rewind:'위치만 되돌렸습니다. 바꾼 세상은 그대로입니다.', 'exit-open':'모든 시간이 모였습니다. 출구가 열립니다!','need-key':'이 문을 열려면 시간 열쇠가 필요합니다.','need-gears':'톱니바퀴를 모두 모으면 출구가 열립니다.',blocked:'그쪽으로는 이동할 수 없습니다.','no-rewind':'모래시계로 기준점을 만든 뒤 다른 칸에서 되감으세요.' };
  const sounds = {gear:'collect-gear',hourglass:'collect-hourglass',key:'collect-key',unlock:'door-unlock',crack:'fragile-floor-crack',collapse:'fragile-floor-collapse',rewind:'rewind','exit-open':'exit-open','need-key':'move-blocked','need-gears':'move-blocked',blocked:'move-blocked','no-rewind':'move-blocked'};
  for (const event of outcome.events) {
    if (messages[event]) $('game-message').textContent = messages[event];
    if (sounds[event]) audio.sfx(sounds[event]);
    if (event === 'step') audio.sfx(`step-stone-0${game.moveCount % 2 ? 1 : 2}`);
    if (event === 'hourglass') audio.later(() => { audio.stopSfx('collect-hourglass'); audio.sfx('time-anchor'); }, 700);
    if (tutorial && !tutorial.done && event === lessons[tutorial.step][2]) tutorial.done = true;
  }
  renderGame(); renderTutorial();
  if (game.gameState === 'GAME_OVER') endGame(); else if (outcome.events.some(e => ['step','rewind'].includes(e))) persistGame();
  if (outcome.rewindPath) playRewind(outcome.rewindPath, origin);
}
function endGame() {
  const won = game.resultType === 'WIN';
  if (tutorial) finishTutorial();
  store.remove(userKey('save')); $('save-status').textContent = '탐험 종료 · 임시 기록 정리됨';
  if (won) {
    const old = progress.stageRecords[game.stageId]?.bestScore ?? 0;
    progress.stageRecords[game.stageId] = { cleared:true, bestScore:Math.max(old, game.score) };
    progress.unlockedStage = Math.max(progress.unlockedStage, Math.min(STAGES.length, game.stageId + 1)); store.write(userKey('progress'), progress);
  }
  if (won && game.stageId === STAGES.length) {
    audio.change(null); audio.sfx('all-clear'); audio.later(() => { audio.change('bgm-all-clear', false); audio.duck(); }, 1000);
  } else { audio.duck(); if (!won) audio.sfx('time-rift'); audio.sfx(won ? 'stage-clear' : 'game-over'); }
  openModal(won ? (game.stageId === STAGES.length ? '시계탑이 다시 깨어났습니다' : '한 층의 시간을 되찾았습니다') : '시간의 균열에 닿았습니다', `<img class="result-symbol" src="assets/images/${won ? 'time-gear.png' : 'time-rift.png'}" alt=""><p class="result-title">${won ? (game.stageId === STAGES.length ? '열 층에 시간이 흐릅니다. 당신의 모험이 기록되었습니다.' : `${game.stageId + 1}층이 열렸습니다. 다음 이야기가 기다립니다.`) : '괜찮아요. 다시 시작하면 새로운 시간이 주어집니다.'}</p><div class="result-stats"><div><small>최종 점수</small><strong>${format(game.score)}</strong></div><div><small>이동 횟수</small><strong>${game.moveCount}</strong></div><div><small>시간 톱니</small><strong>${game.collectedGearCount} / ${game.totalGearCount}</strong></div><div><small>사용한 되감기</small><strong>${game.rewindUsedCount}</strong></div></div><div class="modal-actions">${won ? `<button id="next-stage" class="primary wide">${game.stageId === STAGES.length ? '전체 결과 보기' : '다음 스테이지'} →</button>` : ''}<button id="result-retry" class="${won ? 'secondary' : 'primary'} wide">다시 도전 ↶</button><button id="result-stages" class="secondary wide">스테이지 선택</button><button data-action="main" class="text-button">메인 화면</button></div>`);
  if (won) $('next-stage').onclick = () => game.stageId === STAGES.length ? showAllClear() : startStage(game.stageId + 1);
  $('result-retry').onclick = () => startStage(game.stageId); $('result-stages').onclick = showStages;
}
function showAllClear() {
  openModal('되찾은 열 개의 시간', `<p>탐험가의 최고 기록을 모았습니다. 이미 오른 층에도 새로운 길이 있습니다.</p><div class="result-stats"><div><small>전체 최고 점수 합계</small><strong>${format(totalBest())}</strong></div><div><small>완료한 스테이지</small><strong>${Object.keys(progress.stageRecords).length} / ${STAGES.length}</strong></div></div><ul class="all-clear-list">${STAGES.map(s=>`<li><span>${String(s.id).padStart(2,'0')} · ${s.name}</span><strong>${format(progress.stageRecords[s.id]?.bestScore ?? 0)}</strong></li>`).join('')}</ul><div class="modal-actions"><button id="all-stages" class="primary wide">다시 시계탑으로 →</button><button data-action="main" class="text-button">메인 화면</button></div>`);
  $('all-stages').onclick = showStages;
}

function resolveImages(container) {
  container.querySelectorAll('img[src^="assets/"]').forEach(img => { img.src = assetUrl(img.getAttribute('src').slice(7)); });
}
function openModal(title, body) {
  if ($('modal').open) $('modal').close();
  $('modal-content').innerHTML = `<p class="eyebrow">REWIND TOWER · EXPLORER'S JOURNAL</p><h2 id="modal-title"></h2>${body}`;
  $('modal-title').textContent = title; resolveImages($('modal-content')); $('modal').showModal();
}
function closeModal() { if ($('modal').open) $('modal').close(); }
function confirmAction(title, body, action) {
  openModal(title, `<p>${body}</p><div class="modal-actions"><button id="confirm-yes" class="primary wide">확인</button><button id="confirm-no" class="secondary wide">취소</button></div>`);
  $('confirm-yes').onclick = () => { closeModal(); action(); }; $('confirm-no').onclick = closeModal;
}
function openHelp() {
  const entries = [ ['time-gear.png','시간 톱니','모두 모으면 출구가 열려요'],['hourglass.png','모래시계','되감기 +1, 새 기준점 생성'],['time-anchor.png.png','시간 기준점','R을 누르면 이곳으로 돌아와요'],['exit-open.png','열린 출구','들어가면 다음 층이 열려요'],['fragile-floor.png','무너지는 발판','떠난 뒤에는 건널 수 없어요'],['time-key.png','열쇠와 문','열쇠 1개로 문 1개를 열어요'],['time-rift.png','시간 균열','밟으면 이번 탐험이 끝나요'] ];
  openModal('당신의 위치만, 되감으세요', `<p><kbd>↑</kbd> <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd> 또는 <kbd>W A S D</kbd> 이동<br><kbd>R</kbd> 시간 되감기 · 화면 화살표와 되감기 버튼으로도 조작할 수 있어요.</p><div class="help-grid">${entries.map(([file,title,desc])=>`<div class="help-item"><img src="assets/images/${file}" alt=""><div><strong>${title}</strong>${desc}</div></div>`).join('')}</div><p>되감기는 최신 모래시계 이후의 발자국을 역순으로 따라갑니다. 수집한 아이템, 열린 문, 무너진 발판은 그대로입니다. 기준점에 서 있으면 되감기를 소비하지 않습니다.</p><p>시작 1,000점 · 톱니 +100 · 이동 -3 · 되감기 -50 · 클리어 +500<br>정상 이동 후 자동 저장됩니다. 기록 저장 버튼으로도 저장할 수 있어요.</p><div class="modal-actions">${user ? '<button id="replay-tutorial" class="secondary wide">첫 층 튜토리얼 다시 보기</button>' : ''}<button id="help-close" class="primary wide">알겠습니다</button></div>`);
  $('help-close').onclick = closeModal;
  if (user) $('replay-tutorial').onclick = () => requestStart(1, true);
}
function openSettings() {
  const hasSave = store.read(userKey('save')) !== null;
  openModal('소리와 탐험 기록', `<div class="setting-row"><label for="bgm-volume">배경음 <span id="bgm-value">${Math.round(audio.settings.bgmVolume*100)}%</span></label><input id="bgm-volume" type="range" min="0" max="100" value="${audio.settings.bgmVolume*100}"></div><div class="setting-row"><label for="sfx-volume">효과음 <span id="sfx-value">${Math.round(audio.settings.sfxVolume*100)}%</span></label><input id="sfx-volume" type="range" min="0" max="100" value="${audio.settings.sfxVolume*100}"></div><p>설정과 기록은 현재 탐험가에게만 적용됩니다.</p><div class="modal-actions"><button id="delete-save" class="secondary wide" ${hasSave ? '' : 'disabled'}>저장 기록 삭제</button><button id="reset-progress" class="secondary wide">진행도 초기화</button><button id="delete-account" class="secondary danger wide">계정 삭제</button></div>`);
  for (const type of ['bgm','sfx']) $(type+'-volume').oninput = event => { audio.settings[type+'Volume'] = Number(event.target.value)/100; $(type+'-value').textContent = `${event.target.value}%`; audio.sync(); store.write(userKey('settings'), audio.settings); };
  $('delete-save').onclick = () => confirmAction('진행 중인 기록을 지울까요?', '이어하기 기록만 삭제됩니다. 해금과 최고 점수는 유지됩니다.', () => { store.remove(userKey('save')); game = null; showMain(); toast('저장 기록을 삭제했습니다.'); });
  $('reset-progress').onclick = () => confirmAction('처음부터 시간을 되찾을까요?', '모든 해금, 최고 점수와 이어하기 기록을 삭제합니다. 이 작업은 되돌릴 수 없습니다.', () => { store.remove(userKey('save')); store.remove(userKey('progress')); progress = readProgress(null); game = null; showMain(); toast('진행도를 초기화했습니다.'); });
  $('delete-account').onclick = openDeleteAccount;
}
function openDeleteAccount() {
  openModal('탐험가의 기록을 삭제할까요?', `<p>현재 계정과 모든 진행, 점수, 설정을 영구 삭제합니다. 다른 계정의 기록은 유지됩니다.</p><form id="delete-form"><label for="delete-pin">현재 4자리 PIN</label><input id="delete-pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required autocomplete="current-password"><label class="setting-row"><input id="delete-agree" type="checkbox" required>복구할 수 없는 삭제에 동의합니다.</label><p id="delete-error" class="form-error" role="alert"></p><button id="delete-submit" class="secondary danger wide" type="submit">계정과 기록 영구 삭제</button></form>`);
  $('delete-form').onsubmit = async event => {
    event.preventDefault(); const button = $('delete-submit'); if (button.disabled) return; button.disabled = true;
    const owner = user;
    try {
      const entered = $('delete-pin').value; $('delete-pin').value = '';
      if (!validPin(entered) || await hashPin(entered, owner.pinSalt) !== owner.pinHash) throw new Error('PIN을 확인하세요.');
      if (user !== owner || !$('modal').open || !$('delete-agree')?.checked) return;
      const accounts = store.read(ACCOUNT_KEY, []); if (!validAccounts(accounts)) throw new Error('계정 목록을 읽을 수 없습니다.');
      store.write(ACCOUNT_KEY, accounts.filter(a => a.id !== owner.id));
      for (const type of ['save','progress','settings','tutorial']) store.remove(userKey(type));
      game = null; logout(); toast('현재 계정과 기록을 삭제했습니다.');
    } catch (error) { if ($('delete-error')) $('delete-error').textContent = error.message; audio.sfx('login-fail'); }
    finally { button.disabled = false; }
  };
}

function setAuthMode(mode) {
  authMode = mode; const creating = mode === 'create';
  $('auth-title').textContent = creating ? '새로운 탐험가의 기록' : '시계탑에 오신 것을 환영합니다';
  $('auth-description').textContent = creating ? '당신만의 닉네임과 4자리 PIN을 정해주세요.' : '기록을 열고, 멈춘 시간 속으로 들어가세요.';
  $('pin-confirm-group').hidden = !creating; $('pin-confirm').required = creating;
  $('pin').autocomplete = creating ? 'new-password' : 'current-password';
  $('auth-submit').innerHTML = creating ? '계정 만들고 시작 <span>→</span>' : '기록 열기 <span>→</span>';
  $('auth-toggle').innerHTML = creating ? '이미 기록이 있나요? <strong>로그인</strong>' : '처음 오셨나요? <strong>새 계정 만들기</strong>';
  $('auth-error').textContent = ''; $('pin').value = ''; $('pin-confirm').value = '';
}
$('auth-form').onsubmit = async event => {
  event.preventDefault(); if (authBusy) return; authBusy = true; $('auth-submit').disabled = true; $('auth-toggle').disabled = true; $('auth-error').textContent = '';
  try {
    const nickname = $('nickname').value.trim().normalize('NFKC'), pin = $('pin').value, confirmation = $('pin-confirm').value;
    if (!validNickname(nickname)) throw new Error('닉네임은 한글·영문·숫자·밑줄·하이픈 2–12자로 입력하세요.');
    if (!validPin(pin)) throw new Error('PIN은 숫자 4자리로 입력하세요.');
    const accounts = store.read(ACCOUNT_KEY, []);
    if (!validAccounts(accounts)) throw new Error('계정 목록이 손상되어 읽을 수 없습니다. 브라우저의 기존 기록을 확인하세요.');
    let account = accounts.find(a => normalizeNickname(a.nickname) === normalizeNickname(nickname));
    if (authMode === 'create') {
      if (pin !== confirmation) throw new Error('확인 PIN이 일치하지 않습니다.');
      if (account) throw new Error('다른 닉네임을 사용해주세요.');
      if (!globalThis.crypto?.subtle) throw new Error('최신 브라우저의 localhost 또는 HTTPS 주소에서 실행해주세요.');
      const pinSalt = randomHex(); const pinHash = await hashPin(pin, pinSalt);
      // Re-read after asynchronous hashing to avoid overwriting another tab's newly created account.
      const latest = store.read(ACCOUNT_KEY, []);
      if (!validAccounts(latest) || latest.some(a => normalizeNickname(a.nickname) === normalizeNickname(nickname))) throw new Error('다른 닉네임을 사용해주세요.');
      account = { id:randomHex(), nickname, pinSalt, pinHash, createdAt:new Date().toISOString() }; store.write(ACCOUNT_KEY, [...latest, account]);
    } else {
      const verification = await hashPin(pin, account?.pinSalt || '00000000000000000000000000000000');
      if (!account || verification !== account.pinHash) throw new Error('닉네임 또는 PIN을 확인하세요.');
    }
    user = account; progress = readProgress(store.read(userKey('progress'))); corruptSaveNotified = false;
    audio.apply(store.read(userKey('settings'))); updateMute(); showMain(); audio.sfx('login-success');
  } catch (error) { $('auth-error').textContent = error.message; audio.sfx('login-fail'); }
  finally { $('pin').value = ''; $('pin-confirm').value = ''; authBusy = false; $('auth-submit').disabled = false; $('auth-toggle').disabled = false; }
};
function logout(saveCurrent = true) {
  if (saveCurrent && screen === 'GAME') persistGame();
  closeModal(); user = null; progress = null; game = null; tutorial = null;
  audio.apply({ muted: true }); updateMute(); setAuthMode('login'); $('nickname').value = ''; showScreen('LOGIN');
}
function updateMute() { $('mute-button').textContent = audio.settings.muted ? '♪̸' : '♫'; $('mute-button').setAttribute('aria-pressed', String(audio.settings.muted)); $('mute-button').setAttribute('aria-label', audio.settings.muted ? '소리 켜기' : '음소거'); }

$('auth-toggle').onclick = () => setAuthMode(authMode === 'login' ? 'create' : 'login');
$('new-game-button').onclick = () => {
  if (getSave()) confirmAction('새 게임을 시작할까요?', '진행 중인 임시 기록을 교체하고 1층부터 시작합니다. 해금과 최고 기록은 유지됩니다.', () => startStage(1)); else startStage(1);
};
$('continue-button').onclick = continueGame; $('stages-button').onclick = showStages;
$('stage-cards').onclick = event => { const button = event.target.closest('[data-stage]'); if (button && !button.disabled) requestStart(Number(button.dataset.stage)); };
$('logout-button').onclick = () => logout(); $('settings-button').onclick = openSettings;
$('brand-home').onclick = event => { event.preventDefault(); if (user) showMain(); };
$('help-button').onclick = openHelp; $('save-button').onclick = () => persistGame(true);
$('restart-button').onclick = () => confirmAction('이 층을 다시 시작할까요?', '현재 층의 이동과 수집을 처음 상태로 되돌립니다.', () => startStage(game.stageId));
$('rewind-button').onclick = () => input('rewind');
$('map-zoom').onclick = () => {
  const zoomed = $('board').classList.toggle('zoomed');
  $('map-zoom').setAttribute('aria-pressed', String(zoomed));
  $('map-zoom').textContent = zoomed ? '맵 전체 보기 －' : '맵 확대 ＋';
  if (!rewindPlayback) positionPlayer(game.playerPosition, game.direction);
};
$('tutorial-skip').onclick = finishTutorial;
$('tutorial-next').onclick = () => { if (!tutorial || (!tutorial.done && tutorial.step !== 4)) return; if (tutorial.step === 4) finishTutorial(); else { tutorial.step++; tutorial.done = false; renderTutorial(); } };
$('modal-close').onclick = closeModal;
$('modal').addEventListener('click', event => { if (event.target === $('modal')) { const r = $('modal').getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeModal(); } });
$('mute-button').onclick = () => { audio.settings.muted = !audio.settings.muted; audio.sync(); updateMute(); if (user) store.write(userKey('settings'), audio.settings); };
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (button && !button.disabled && !button.dataset.move) audio.sfx('ui-click');
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'main') showMain(); if (action === 'help') openHelp();
  const move = event.target.closest('[data-move]')?.dataset.move; if (move) input(move);
});
document.addEventListener('pointerover', event => { if (event.pointerType === 'mouse' && event.target.closest('button:not(:disabled)') && !event.target.closest('button').contains(event.relatedTarget)) audio.sfx('ui-hover'); });
document.addEventListener('pointerdown', () => audio.unlock(), { capture:true });
document.addEventListener('keydown', event => {
  audio.unlock();
  if (event.target.matches('input,textarea,select') || $('modal').open) return;
  const actions = {ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',r:'rewind'};
  const action = actions[event.key] || actions[event.key.toLowerCase()];
  if (action && screen === 'GAME') { event.preventDefault(); input(action); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    persistGame(); audio.suspend();
    if (rewindPlayback) { cancelRewindPlayback(); renderGame(); renderTutorial(); }
  } else audio.resume();
});
// Another tab may replace a save or delete this profile. Never write the stale in-memory game back over it.
window.addEventListener('storage', event => {
  if (!user || !store.available) return;
  if (event.key === null || event.key === ACCOUNT_KEY) {
    const accounts = store.read(ACCOUNT_KEY, []);
    if (!validAccounts(accounts) || !accounts.some(a => a.id === user.id)) {
      logout(false); toast('다른 창에서 계정 기록이 변경되었습니다. 다시 로그인해주세요.');
    }
    return;
  }
  if (![userKey('save'),userKey('progress')].includes(event.key)) return;
  if (screen === 'GAME' && game?.gameState === 'PLAYING') {
    logout(false); toast('다른 창에서 이 계정의 게임이 진행되어 현재 창을 잠갔습니다. 다시 로그인하면 최신 기록을 이어갈 수 있습니다.');
  } else {
    game = null; progress = readProgress(store.read(userKey('progress')));
    if (screen === 'MAIN') showMain(); else if (screen === 'STAGE_SELECT') showStages();
  }
});
window.addEventListener('pagehide', () => persistGame());
audio.change('bgm-menu'); updateMute(); showScreen('LOGIN');
$('boot-status').hidden = true;
if (validAccounts(store.read(ACCOUNT_KEY, [])) && store.read(ACCOUNT_KEY, []).length === 0) setAuthMode('create');
