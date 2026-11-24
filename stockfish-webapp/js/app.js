import { Chess, DEFAULT_POSITION } from '../vendor/chess.js';
import { Board } from './board.js';
import { Engine, ENGINES } from './engine.js';

const $ = (id) => document.getElementById(id);
const ARROW_COLORS = ['#15781b', '#1f6fb2', '#a35b00'];

const state = {
  startFen: DEFAULT_POSITION,
  moves: [], // verbose moves from chess.js
  ply: 0,
  game: new Chess(),
  mode: 'analysis', // 'analysis' | 'play'
  playerColor: 'w',
  engine: null,
  engineKey: 'lite',
  lines: [],
  thinking: false,
};

// ---------- position handling ----------

function rebuild() {
  const g = new Chess(state.startFen);
  for (let i = 0; i < state.ply; i++) g.move(state.moves[i]);
  state.game = g;
}

function pushMove(move) {
  state.moves = state.moves.slice(0, state.ply);
  state.moves.push(move);
  state.ply++;
  rebuild();
  update();
}

function tryMove(from, to, promotion) {
  const probe = new Chess(state.game.fen());
  let mv;
  try {
    mv = probe.move({ from, to, promotion: promotion || 'q' });
  } catch {
    board.render();
    return;
  }
  if (mv.promotion && !promotion) {
    askPromotion(state.game.turn()).then((p) => {
      if (p) tryMove(from, to, p);
      else board.render();
    });
    return;
  }
  pushMove({ from: mv.from, to: mv.to, promotion: mv.promotion, san: mv.san });
}

function askPromotion(color) {
  return new Promise((resolve) => {
    const dlg = $('promo');
    const box = dlg.querySelector('.choices');
    box.innerHTML = '';
    const glyph = { q: '♛', r: '♜', b: '♝', n: '♞' };
    for (const p of ['q', 'r', 'b', 'n']) {
      const b = document.createElement('button');
      b.className = `piece ${color === 'w' ? 'white' : 'black'}`;
      b.textContent = glyph[p] + '︎';
      b.onclick = () => { dlg.close(); resolve(p); };
      box.append(b);
    }
    dlg.onclose = () => resolve(null);
    dlg.showModal();
  });
}

// ---------- board ----------

const board = new Board($('board'), {
  getPiece: (sq) => state.game.get(sq) || null,
  legalTargets: (sq) => state.game.moves({ square: sq, verbose: true }).map((m) => m.to),
  canMove: (color) => {
    if (state.game.isGameOver() || color !== state.game.turn()) return false;
    if (state.mode === 'play') return color === state.playerColor && !state.thinking && state.ply === state.moves.length;
    return true;
  },
  onMove: (from, to) => tryMove(from, to),
});

// ---------- UI update ----------

function update() {
  const g = state.game;
  const last = state.ply > 0 ? state.moves[state.ply - 1] : null;
  board.lastMove = last;
  board.checkSquare = null;
  if (g.inCheck()) {
    const turn = g.turn();
    for (const row of g.board()) for (const p of row) if (p && p.type === 'k' && p.color === turn) board.checkSquare = p.square;
  }
  board.selected = null;
  board.setArrows([]);
  board.render();
  renderMoves();
  renderStatus();
  $('fen').value = g.fen();
  state.lines = [];
  renderLines();
  runEngine();
}

function renderStatus() {
  const g = state.game;
  let s;
  if (g.isCheckmate()) s = `Schachmatt – ${g.turn() === 'w' ? 'Schwarz' : 'Weiß'} gewinnt`;
  else if (g.isStalemate()) s = 'Patt – Remis';
  else if (g.isThreefoldRepetition()) s = 'Dreifache Stellungswiederholung – Remis';
  else if (g.isInsufficientMaterial()) s = 'Ungenügendes Material – Remis';
  else if (g.isDraw()) s = '50-Züge-Regel – Remis';
  else {
    s = `${g.turn() === 'w' ? 'Weiß' : 'Schwarz'} am Zug${g.inCheck() ? ' (Schach)' : ''}`;
    if (state.mode === 'play' && state.thinking) s += ' – Stockfish denkt …';
  }
  $('status').textContent = s;
}

function renderMoves() {
  const list = $('moves');
  list.innerHTML = '';
  const startTurn = new Chess(state.startFen).turn();
  const startNo = +state.startFen.split(' ')[5] || 1;
  let row = null;
  state.moves.forEach((m, i) => {
    const whiteMove = (i % 2 === 0) === (startTurn === 'w');
    if (!row || whiteMove) {
      row = document.createElement('li');
      const no = startNo + Math.floor((i + (startTurn === 'b' ? 1 : 0)) / 2);
      row.innerHTML = `<span class="no">${no}.</span>`;
      if (!whiteMove) row.insertAdjacentHTML('beforeend', '<span class="mv empty">…</span>');
      list.append(row);
    }
    const span = document.createElement('span');
    span.className = 'mv' + (i + 1 === state.ply ? ' current' : '');
    span.textContent = m.san;
    span.onclick = () => goTo(i + 1);
    row.append(span);
  });
  list.querySelector('.current')?.scrollIntoView({ block: 'nearest' });
}

function goTo(ply) {
  state.ply = Math.max(0, Math.min(state.moves.length, ply));
  rebuild();
  update();
}

// ---------- engine ----------

function whiteScore(info, turn) {
  const sign = turn === 'w' ? 1 : -1;
  return { type: info.scoreType, value: info.score * sign };
}

function fmtScore(sc) {
  if (sc.type === 'mate') return sc.value > 0 ? `#${sc.value}` : `#-${-sc.value}`;
  const v = sc.value / 100;
  return (v > 0 ? '+' : '') + v.toFixed(2);
}

function pvToSan(fen, pv, max = 12) {
  const g = new Chess(fen);
  const out = [];
  for (const uci of pv.slice(0, max)) {
    try {
      const m = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      out.push(m.san);
    } catch {
      break;
    }
  }
  return out.join(' ');
}

function setEvalBar(sc) {
  let pct;
  if (!sc) pct = 50;
  else if (sc.type === 'mate') pct = sc.value > 0 ? 100 : 0;
  else pct = 50 + 50 * (2 / (1 + Math.exp(-0.004 * sc.value)) - 1);
  $('evalWhite').style.height = `${pct}%`;
  $('evalText').textContent = sc ? fmtScore(sc) : '';
  $('evalbar').classList.toggle('flipped', board.flipped);
}

function renderLines() {
  const box = $('lines');
  const show = state.mode === 'analysis' || state.game.isGameOver();
  $('evalbar').style.visibility = show ? 'visible' : 'hidden';
  if (!show) {
    box.innerHTML = '<p class="muted">Engine-Bewertung ist im Spielmodus ausgeblendet.</p>';
    return;
  }
  const fen = state.game.fen();
  const turn = state.game.turn();
  box.innerHTML = '';
  if (!state.lines.length) {
    box.innerHTML = state.game.isGameOver() ? '' : '<p class="muted">Analysiere …</p>';
    setEvalBar(state.game.isCheckmate() ? { type: 'mate', value: turn === 'w' ? -1 : 1 } : null);
    if (state.game.isCheckmate()) $('evalText').textContent = '#';
    return;
  }
  state.lines.forEach((info, i) => {
    if (!info) return;
    const sc = whiteScore(info, turn);
    const div = document.createElement('div');
    div.className = 'line';
    div.innerHTML = `<span class="score ${sc.value >= 0 ? 'pos' : 'neg'}">${fmtScore(sc)}</span>
      <span class="pv"></span>`;
    div.querySelector('.pv').textContent = pvToSan(fen, info.pv);
    div.style.borderLeftColor = ARROW_COLORS[i] || '#888';
    div.title = 'Klicken, um den ersten Zug dieser Linie zu spielen';
    div.onclick = () => {
      const m = info.pv[0];
      tryMove(m.slice(0, 2), m.slice(2, 4), m[4]);
    };
    box.append(div);
  });
  const best = state.lines[0];
  if (!best) return;
  const d = best;
  $('engineInfo').textContent = `Tiefe ${d.depth}${d.seldepth ? '/' + d.seldepth : ''} · ${fmtNodes(d.nps)} kN/s`;
  setEvalBar(whiteScore(best, turn));
  if ($('showArrows').checked) {
    board.setArrows(state.lines.filter(Boolean).map((l, i) => ({
      from: l.pv[0].slice(0, 2), to: l.pv[0].slice(2, 4), color: ARROW_COLORS[i] || '#888',
    })));
  }
}

function fmtNodes(nps) {
  return nps ? Math.round(nps / 1000).toLocaleString('de-DE') : '–';
}

async function runEngine() {
  const eng = state.engine;
  if (!eng) return;
  const g = state.game;
  if (g.isGameOver()) {
    await eng.stop();
    $('engineInfo').textContent = '';
    renderLines();
    return;
  }
  const fen = g.fen();

  if (state.mode === 'analysis') {
    const multipv = +$('multipv').value;
    const depth = +$('depth').value;
    state.thinking = false;
    let throttle = 0;
    const res = await eng.search(fen, { depth, multipv }, (info) => {
      if (info.bound) return;
      state.lines[info.multipv - 1] = info;
      const now = performance.now();
      if (now - throttle > 120) { throttle = now; renderLines(); }
    });
    if (res) renderLines();
    return;
  }

  // play mode
  if (g.turn() === state.playerColor || state.ply !== state.moves.length) {
    await eng.stop();
    state.thinking = false;
    renderStatus();
    return;
  }
  state.thinking = true;
  renderStatus();
  const elo = +$('elo').value;
  const movetime = +$('movetime').value;
  const res = await eng.search(fen, { movetime, multipv: 1, elo: elo >= 3190 ? null : elo }, null);
  if (!res) return; // superseded
  state.thinking = false;
  if (res.bestmove && state.game.fen() === fen) {
    tryMove(res.bestmove.slice(0, 2), res.bestmove.slice(2, 4), res.bestmove[4]);
  } else {
    renderStatus();
  }
}

async function loadEngine(key) {
  $('engineName').textContent = 'Engine wird geladen …';
  if (state.engine) {
    await state.engine.stop();
    state.engine.terminate();
    state.engine = null;
  }
  try {
    const eng = await new Engine(ENGINES[key].path).init();
    state.engine = eng;
    state.engineKey = key;
    $('engineName').textContent = eng.name;
    runEngine();
  } catch (err) {
    console.error(err);
    if (key !== 'lite') {
      $('engineName').textContent = 'Full-Engine nicht gefunden – siehe README (scripts/fetch-full-engine.sh). Lade Lite …';
      $('engineSelect').value = 'lite';
      setTimeout(() => loadEngine('lite'), 1500);
    } else {
      $('engineName').textContent = 'Engine konnte nicht geladen werden. Läuft die Seite über einen Webserver (nicht file://)?';
    }
  }
}

// ---------- controls ----------

function newGame(fen = DEFAULT_POSITION) {
  state.startFen = fen;
  state.moves = [];
  state.ply = 0;
  rebuild();
  if (state.mode === 'play') board.setFlipped(state.playerColor === 'b');
  update();
}

function setMode(mode) {
  state.mode = mode;
  document.body.dataset.mode = mode;
  update();
}

$('modeAnalysis').onclick = () => setMode('analysis');
$('modePlay').onclick = () => setMode('play');
$('newGame').onclick = () => {
  state.playerColor = $('color').value === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : $('color').value;
  newGame();
};
$('flip').onclick = () => { board.flip(); setEvalBar(state.lines[0] ? whiteScore(state.lines[0], state.game.turn()) : null); };
$('first').onclick = () => goTo(0);
$('prev').onclick = () => goTo(state.ply - 1);
$('next').onclick = () => goTo(state.ply + 1);
$('last').onclick = () => goTo(state.moves.length);
$('undo').onclick = () => {
  // in play mode take back the engine reply as well
  let n = 1;
  if (state.mode === 'play' && state.game.turn() === state.playerColor && state.ply >= 2) n = 2;
  state.moves = state.moves.slice(0, Math.max(0, state.ply - n));
  goTo(state.moves.length);
};

$('loadFen').onclick = () => {
  const fen = $('fen').value.trim();
  try {
    new Chess(fen);
    newGame(fen);
  } catch (e) {
    alert('Ungültige FEN: ' + e.message);
  }
};
$('copyFen').onclick = () => navigator.clipboard?.writeText(state.game.fen());

$('importPgn').onclick = () => {
  const g = new Chess();
  try {
    g.loadPgn($('pgn').value);
  } catch (e) {
    alert('PGN konnte nicht gelesen werden: ' + e.message);
    return;
  }
  const moves = g.history({ verbose: true }).map((m) => ({ from: m.from, to: m.to, promotion: m.promotion, san: m.san }));
  while (g.undo());
  state.startFen = g.fen();
  state.moves = moves;
  goTo(moves.length);
};
$('exportPgn').onclick = () => {
  const g = new Chess(state.startFen);
  if (state.startFen !== DEFAULT_POSITION) { g.header('SetUp', '1', 'FEN', state.startFen); }
  g.header('Event', 'Stockfish Web Analyse', 'Date', new Date().toISOString().slice(0, 10).replace(/-/g, '.'));
  for (const m of state.moves) g.move(m);
  $('pgn').value = g.pgn();
};

for (const id of ['multipv', 'depth', 'elo', 'movetime']) {
  $(id).addEventListener('input', () => {
    $(id + 'Val').textContent = $(id).value + (id === 'movetime' ? ' ms' : '');
    if (id === 'elo' && +$(id).value >= 3190) $('eloVal').textContent = 'Max';
  });
  $(id).addEventListener('change', () => { if (state.mode === 'analysis') { state.lines = []; renderLines(); runEngine(); } });
}
$('showArrows').onchange = () => { if (!$('showArrows').checked) board.setArrows([]); else renderLines(); };
$('engineSelect').onchange = () => loadEngine($('engineSelect').value);

document.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  if (e.key === 'ArrowLeft') $('prev').click();
  else if (e.key === 'ArrowRight') $('next').click();
  else if (e.key === 'Home') $('first').click();
  else if (e.key === 'End') $('last').click();
  else if (e.key === 'f') $('flip').click();
});

// ---------- boot ----------
for (const [key, e] of Object.entries(ENGINES)) {
  $('engineSelect').insertAdjacentHTML('beforeend', `<option value="${key}">${e.label}</option>`);
}
document.body.dataset.mode = state.mode;
update();
loadEngine('lite');
