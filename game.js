"use strict";

(() => {
  const colors = ["red", "blue", "green"];
  const names = { red: "빨강", blue: "파랑", green: "초록" };
  const maxLevel = 5;
  const $ = (id) => document.getElementById(id);
  const buttons = [...document.querySelectorAll("[data-color]")];
  const timers = new Map();
  let gameState = "READY";
  let phase = "ready";
  let score = 0;
  let level = 1;
  let colorSequence = [];
  let playerSequence = [];
  let inputIndex = 0;
  let isShowingSequence = false;
  let generation = 0;
  let previousBest = 0;
  let isMuted = readStorage("color-memory-muted") === "true";
  let bestScore = Number(readStorage("color-memory-best")) || 0;
  bestScore = Math.max(0, Math.min(50, Math.floor(bestScore / 10) * 10));

  const bgm = new Audio("Sounds/bgm.mp3");
  bgm.loop = true;
  bgm.volume = 0.16;
  bgm.preload = "auto";
  const soundEffects = Object.fromEntries([...colors, "correct", "wrong", "victory"].map((name) => {
    const sound = new Audio(`Sounds/${name}.mp3`);
    sound.preload = "auto";
    sound.volume = colors.includes(name) ? 0.55 : 0.65;
    return [name, sound];
  }));
  let effectTimer;

  function readStorage(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function writeStorage(key, value) {
    try { localStorage.setItem(key, String(value)); } catch { /* Private browsing can block storage. */ }
  }
  function safePlay(sound) {
    try { const promise = sound.play(); if (promise) promise.catch(() => {}); } catch { /* Sound is optional. */ }
  }
  function playBgm() {
    if (!isMuted && gameState === "PLAYING" && !document.hidden) safePlay(bgm);
  }
  function stopBgm() { bgm.pause(); try { bgm.currentTime = 0; } catch {} }
  function stopEffects() {
    clearTimeout(effectTimer);
    Object.values(soundEffects).forEach((sound) => { sound.pause(); });
  }
  function playSound(name, duration) {
    if (isMuted || document.hidden) return;
    stopEffects();
    const sound = soundEffects[name];
    try { sound.currentTime = 0; } catch {}
    safePlay(sound);
    // Supplied color clips vary in length; keep each cue short and distinct.
    if (duration) effectTimer = setTimeout(() => sound.pause(), duration);
  }
  function updateSoundButton() {
    $("sound-toggle").setAttribute("aria-pressed", String(isMuted));
    $("sound-toggle").setAttribute("aria-label", isMuted ? "소리 켜기" : "소리 끄기");
    $("sound-label").textContent = isMuted ? "소리 꺼짐" : "소리 켜짐";
  }
  function toggleMute() {
    isMuted = !isMuted;
    writeStorage("color-memory-muted", isMuted);
    if (isMuted) { bgm.pause(); stopEffects(); } else playBgm();
    updateSoundButton();
  }

  function wait(ms) {
    return new Promise((resolve) => {
      const id = setTimeout(() => { timers.delete(id); resolve(true); }, ms);
      timers.set(id, resolve);
    });
  }
  function cancelPending() {
    generation++;
    for (const [id, resolve] of timers) { clearTimeout(id); resolve(false); }
    timers.clear();
    buttons.forEach((button) => button.classList.remove("lit"));
  }
  function setColorButtonsEnabled(enabled) {
    buttons.forEach((button) => button.setAttribute("aria-disabled", String(!enabled)));
  }
  function setStatus(label, title, detail, image = "memory-lightbulb.png") {
    $("phase-label").textContent = label;
    $("status-title").textContent = title;
    $("status-detail").textContent = detail;
    $("status-image").src = `Images/${image}`;
  }
  function updateDisplay() {
    document.body.dataset.state = gameState;
    document.body.dataset.phase = phase;
    $("level").textContent = level;
    $("score").textContent = score;
    $("best-score").textContent = bestScore;
    $("start-button").hidden = gameState !== "READY";
    $("retry-button").hidden = gameState !== "GAME_OVER";
    $("play-area").hidden = gameState === "GAME_OVER";
    $("result").hidden = gameState !== "GAME_OVER";
    document.querySelectorAll("[data-stage]").forEach((step) => {
      const index = Number(step.dataset.stage);
      step.classList.toggle("complete", index <= score / 10);
      step.classList.toggle("current", index === level && index > score / 10);
    });
    $("stage-track").setAttribute("aria-label", `5단계 중 ${score / 10}단계 완료`);
    $("input-progress").replaceChildren();
    if (gameState === "PLAYING") {
      for (let i = 0; i < level; i++) {
        const dot = document.createElement("span");
        dot.classList.toggle("filled", i < inputIndex);
        $("input-progress").append(dot);
      }
    }
    $("input-progress").setAttribute("aria-label", `${level}개 중 ${inputIndex}개 입력`);
    setColorButtonsEnabled(gameState === "PLAYING" && phase === "input" && !isShowingSequence);
  }
  function generateRoundSequence() {
    const previous = colorSequence;
    // By round 2 all three colors have appeared. From round 3, include
    // every color in each round, then shuffle a completely fresh pattern.
    const next = level === 2
      ? colors.filter((color) => !previous.includes(color))
      : level >= 3 ? [...colors] : [];
    while (next.length < level) next.push(colors[Math.floor(Math.random() * colors.length)]);
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    // Prevent accidentally reusing the entire previous pattern as a prefix.
    if (previous.length && previous.every((color, index) => next[index] === color)) {
      const other = next.findIndex((color) => color !== next[0]);
      [next[0], next[other]] = [next[other], next[0]];
    }
    colorSequence = next;
  }
  async function highlightColor(color, duration) {
    const button = buttons.find((item) => item.dataset.color === color);
    button.classList.add("lit");
    playSound(color, duration);
    if (await wait(duration)) button.classList.remove("lit");
  }
  async function showSequence() {
    cancelPending();
    const token = generation;
    phase = "showing";
    isShowingSequence = true;
    inputIndex = 0;
    playerSequence = [];
    setStatus(`${level}단계 · 색깔 ${level}개`, "순서를 기억하세요", "지금은 보는 시간! 반짝이는 색깔에 집중해요.");
    $("control-hint").textContent = "순서를 보여주는 동안에는 입력할 수 없어요.";
    updateDisplay();
    if (!(await wait(650)) || token !== generation) return;
    const duration = 720 - (level - 1) * 60;
    for (const color of colorSequence) {
      await highlightColor(color, duration);
      if (token !== generation || !(await wait(260))) return;
    }
    if (token !== generation) return;
    isShowingSequence = false;
    phase = "input";
    setStatus(`${level}단계 · 나의 차례`, "색깔을 눌러주세요", `기억한 순서대로 ${level}개의 색깔을 눌러주세요.`);
    $("control-hint").textContent = "시간 제한은 없어요. 마우스 · 터치 · 숫자 1, 2, 3";
    updateDisplay();
  }
  function startGame() {
    if (gameState !== "READY") return;
    gameState = "PLAYING";
    score = 0; level = 1; colorSequence = []; playerSequence = []; inputIndex = 0;
    previousBest = bestScore;
    generateRoundSequence();
    playBgm();
    void showSequence();
  }
  function handleColorInput(color) {
    if (gameState !== "PLAYING" || phase !== "input" || isShowingSequence || !colors.includes(color)) return;
    playerSequence.push(color);
    if (color !== colorSequence[inputIndex]) { endGame(false, colorSequence[inputIndex], color); return; }
    void highlightColor(color, 160);
    inputIndex++;
    updateDisplay();
    if (inputIndex === colorSequence.length) void completeLevel();
  }
  async function completeLevel() {
    phase = "transition";
    score += 10;
    if (score > bestScore) { bestScore = score; writeStorage("color-memory-best", bestScore); }
    updateDisplay();
    if (level === maxLevel) { endGame(true); return; }
    const token = generation;
    setStatus(`${level}단계 성공 · +10점`, "정확해요! 잘 기억했어요", "다음은 한 칸 더 긴 새로운 패턴이에요.");
    $("control-hint").textContent = "잠시 후 다음 단계가 시작돼요.";
    playSound("correct");
    if (!(await wait(1050)) || token !== generation) return;
    level++;
    generateRoundSequence();
    void showSequence();
  }
  function endGame(isWin, expected, selected) {
    if (gameState !== "PLAYING") return;
    cancelPending();
    gameState = "GAME_OVER";
    phase = isWin ? "won" : "lost";
    isShowingSequence = false;
    stopBgm();
    playSound(isWin ? "victory" : "wrong");
    setStatus(isWin ? "5단계 모두 성공!" : "괜찮아요, 다시 도전해요", isWin ? "멋져요! 기억력 마스터!" : "아쉬워요! 다음에는 할 수 있어요", isWin ? "모든 색깔 주문을 완벽하게 기억했어요." : `이번 순서는 ${expected ? names[expected] : ""}이었어요. 누른 색깔은 ${selected ? names[selected] : ""}!`, isWin ? "victory-icon.png" : "failure-icon.png");
    $("result-summary").textContent = isWin ? "5단계 완료 · 최종 점수" : `${level}단계 도전 · ${score / 10}단계 완료`;
    $("final-score").textContent = score;
    $("result-record").textContent = score > previousBest ? "새로운 최고 기록을 세웠어요!" : `나의 최고 기록 ${bestScore}점`;
    $("control-hint").textContent = "다시 하기를 누르면 시작 화면으로 돌아가요.";
    updateDisplay();
    $("retry-button").focus({ preventScroll: true });
  }
  function resetGame() {
    cancelPending(); stopBgm(); stopEffects();
    gameState = "READY"; phase = "ready";
    score = 0; level = 1; colorSequence = []; playerSequence = []; inputIndex = 0; isShowingSequence = false;
    setStatus("준비되셨나요?", "기억력에 불을 켜볼까요?", "매 라운드 새로운 색깔 패턴, 5단계에 도전해 보세요.");
    $("control-hint").textContent = "시간 제한 없이, 천천히 즐겨요.";
    updateDisplay();
  }

  $("start-button").addEventListener("click", startGame);
  $("retry-button").addEventListener("click", () => { resetGame(); $("start-button").focus({ preventScroll: true }); });
  $("sound-toggle").addEventListener("click", toggleMute);
  buttons.forEach((button) => button.addEventListener("click", () => handleColorInput(button.dataset.color)));
  document.addEventListener("keydown", (event) => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    const color = { "1": "red", "2": "blue", "3": "green" }[event.key];
    if (color) { event.preventDefault(); handleColorInput(color); }
  });
  // Returning from another tab replays an interrupted sequence fairly.
  document.addEventListener("visibilitychange", () => {
    if (gameState !== "PLAYING") return;
    if (document.hidden) {
      bgm.pause(); stopEffects();
      if (phase === "showing" || phase === "transition") {
        if (phase === "transition") { level++; generateRoundSequence(); }
        cancelPending(); phase = "paused"; isShowingSequence = true; updateDisplay();
      }
    } else {
      playBgm();
      if (phase === "paused") void showSequence();
    }
  });
  updateSoundButton();
  resetGame();
})();
