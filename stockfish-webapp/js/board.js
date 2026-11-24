// Minimal interactive chessboard (click-to-move + drag & drop) with arrow overlay.

const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const FILES = 'abcdefgh';

export class Board {
  /**
   * @param {HTMLElement} el container
   * @param {object} cb { getPiece(sq), legalTargets(sq) -> [sq], canMove(color) -> bool, onMove(from, to) }
   */
  constructor(el, cb) {
    this.el = el;
    this.cb = cb;
    this.flipped = false;
    this.selected = null;
    this.lastMove = null;
    this.checkSquare = null;
    this.arrows = [];
    this.drag = null;

    this.grid = document.createElement('div');
    this.grid.className = 'grid';
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('viewBox', '0 0 800 800');
    this.svg.classList.add('arrows');
    this.el.append(this.grid, this.svg);

    this.squares = {};
    for (let i = 0; i < 64; i++) {
      const d = document.createElement('div');
      d.className = 'sq';
      this.grid.append(d);
    }
    this._layout();

    this.grid.addEventListener('pointerdown', (e) => this._down(e));
    window.addEventListener('pointermove', (e) => this._moveDrag(e));
    window.addEventListener('pointerup', (e) => this._up(e));
  }

  _layout() {
    const cells = [...this.grid.children];
    this.squares = {};
    cells.forEach((d, i) => {
      const r = Math.floor(i / 8), c = i % 8;
      const file = this.flipped ? 7 - c : c;
      const rank = this.flipped ? r + 1 : 8 - r;
      const sq = FILES[file] + rank;
      d.dataset.sq = sq;
      d.classList.toggle('light', (file + rank) % 2 === 1);
      d.classList.toggle('dark', (file + rank) % 2 === 0);
      d.innerHTML = '';
      if (c === 0) d.insertAdjacentHTML('beforeend', `<span class="coord rank">${rank}</span>`);
      if (r === 7) d.insertAdjacentHTML('beforeend', `<span class="coord file">${FILES[file]}</span>`);
      this.squares[sq] = d;
    });
  }

  flip() {
    this.flipped = !this.flipped;
    this._layout();
    this.render();
  }

  setFlipped(v) {
    if (this.flipped !== v) this.flip();
  }

  render() {
    const targets = this.selected ? this.cb.legalTargets(this.selected) : [];
    for (const [sq, d] of Object.entries(this.squares)) {
      d.querySelector('.piece')?.remove();
      const p = this.cb.getPiece(sq);
      if (p) {
        const s = document.createElement('span');
        s.className = `piece ${p.color === 'w' ? 'white' : 'black'}`;
        s.textContent = GLYPH[p.type] + '︎';
        d.append(s);
      }
      d.classList.toggle('selected', sq === this.selected);
      d.classList.toggle('last', !!this.lastMove && (sq === this.lastMove.from || sq === this.lastMove.to));
      d.classList.toggle('check', sq === this.checkSquare);
      d.classList.toggle('target', targets.includes(sq));
      d.classList.toggle('capture', targets.includes(sq) && !!p);
    }
    this._drawArrows();
  }

  setArrows(arrows) {
    this.arrows = arrows;
    this._drawArrows();
  }

  _center(sq) {
    const f = FILES.indexOf(sq[0]);
    const r = +sq[1] - 1;
    const x = this.flipped ? 7 - f : f;
    const y = this.flipped ? r : 7 - r;
    return [x * 100 + 50, y * 100 + 50];
  }

  _drawArrows() {
    const ns = 'http://www.w3.org/2000/svg';
    this.svg.innerHTML = '';
    this.arrows.forEach((a, i) => {
      const [x1, y1] = this._center(a.from);
      const [x2, y2] = this._center(a.to);
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const head = 34;
      const ex = x2 - Math.cos(ang) * head * 0.8;
      const ey = y2 - Math.sin(ang) * head * 0.8;
      const opacity = i === 0 ? 0.85 : 0.45;
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', ex); line.setAttribute('y2', ey);
      line.setAttribute('stroke', a.color); line.setAttribute('stroke-width', 18);
      line.setAttribute('stroke-linecap', 'round'); line.setAttribute('opacity', opacity);
      const poly = document.createElementNS(ns, 'polygon');
      const p1 = [x2, y2];
      const p2 = [x2 - head * Math.cos(ang - 0.5), y2 - head * Math.sin(ang - 0.5)];
      const p3 = [x2 - head * Math.cos(ang + 0.5), y2 - head * Math.sin(ang + 0.5)];
      poly.setAttribute('points', [p1, p2, p3].map((p) => p.join(',')).join(' '));
      poly.setAttribute('fill', a.color); poly.setAttribute('opacity', opacity);
      this.svg.append(line, poly);
    });
  }

  _sqFromPoint(x, y) {
    const el = document.elementFromPoint(x, y)?.closest('.sq');
    return el && this.grid.contains(el) ? el.dataset.sq : null;
  }

  _down(e) {
    const sqEl = e.target.closest('.sq');
    if (!sqEl) return;
    const sq = sqEl.dataset.sq;
    const p = this.cb.getPiece(sq);

    // Second click on a legal target -> move
    if (this.selected && this.cb.legalTargets(this.selected).includes(sq)) {
      const from = this.selected;
      this.selected = null;
      this.cb.onMove(from, sq);
      return;
    }

    if (p && this.cb.canMove(p.color)) {
      e.preventDefault();
      this.selected = sq;
      this.render();
      const pieceEl = sqEl.querySelector('.piece');
      const ghost = pieceEl.cloneNode(true);
      ghost.classList.add('ghost');
      ghost.style.fontSize = getComputedStyle(pieceEl).fontSize;
      document.body.append(ghost);
      pieceEl.classList.add('dragging');
      this.drag = { from: sq, ghost, pieceEl, startX: e.clientX, startY: e.clientY, moved: false };
      this._placeGhost(e);
    } else {
      this.selected = null;
      this.render();
    }
  }

  _placeGhost(e) {
    const g = this.drag.ghost;
    g.style.left = `${e.clientX}px`;
    g.style.top = `${e.clientY}px`;
  }

  _moveDrag(e) {
    if (!this.drag) return;
    if (Math.hypot(e.clientX - this.drag.startX, e.clientY - this.drag.startY) > 4) this.drag.moved = true;
    this._placeGhost(e);
  }

  _up(e) {
    if (!this.drag) return;
    const { from, ghost, pieceEl, moved } = this.drag;
    this.drag = null;
    ghost.remove();
    pieceEl.classList.remove('dragging');
    if (!moved) return; // plain click: keep selection
    const to = this._sqFromPoint(e.clientX, e.clientY);
    if (to && to !== from && this.cb.legalTargets(from).includes(to)) {
      this.selected = null;
      this.cb.onMove(from, to);
    } else {
      this.render();
    }
  }
}
