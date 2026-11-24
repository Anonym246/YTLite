// Small wrapper around a UCI engine running in a Web Worker (Stockfish.js).
// Handles "stop + restart" when a new search is requested while one is running.

export const ENGINES = {
  lite: { label: 'Stockfish 19 Lite (≈1,7 MB)', path: 'engine/stockfish-19-lite-single.js' },
  full: { label: 'Stockfish 19 Full (≈94 MB, stärker)', path: 'engine/stockfish-19-single.js' },
};

export class Engine {
  constructor(path) {
    this.path = path;
    this.worker = null;
    this.name = '';
    this.searchId = 0;
    this.searching = null; // Promise resolved with the bestmove line
    this._onBest = null;
    this._onInfo = null;
    this._waiters = [];
  }

  init() {
    return new Promise((resolve, reject) => {
      try {
        this.worker = new Worker(this.path);
      } catch (err) {
        reject(err);
        return;
      }
      this.worker.onerror = (e) => reject(new Error(e.message || `Engine konnte nicht geladen werden: ${this.path}`));
      this.worker.onmessage = (e) => this._line(String(e.data));
      this.send('uci');
      this._waitFor((l) => l.startsWith('id name'), (l) => { this.name = l.slice(8).trim(); });
      this._waitFor((l) => l === 'uciok', () => {
        this.send('isready');
        this._waitFor((l) => l === 'readyok', () => resolve(this));
      });
    });
  }

  terminate() {
    if (this.worker) this.worker.terminate();
    this.worker = null;
  }

  send(cmd) {
    if (this.worker) this.worker.postMessage(cmd);
  }

  _waitFor(pred, cb) {
    this._waiters.push({ pred, cb });
  }

  _line(line) {
    for (const w of [...this._waiters]) {
      if (w.pred(line)) {
        this._waiters.splice(this._waiters.indexOf(w), 1);
        w.cb(line);
      }
    }
    if (line.startsWith('info') && line.includes(' pv ') && this._onInfo) {
      const info = parseInfo(line);
      if (info) this._onInfo(info);
    } else if (line.startsWith('bestmove') && this._onBest) {
      const done = this._onBest;
      this._onBest = null;
      this._onInfo = null;
      this.searching = null;
      done(line);
    }
  }

  /** Stop any running search (result of the stopped search is discarded). */
  async stop() {
    this.searchId++;
    if (this.searching) {
      this.send('stop');
      await this.searching;
    }
  }

  /**
   * Start a search. Returns { bestmove, ponder } or null if the search was superseded.
   * opts: { depth, movetime, multipv, elo (null = full strength), skill }
   */
  async search(fen, opts, onInfo) {
    const id = ++this.searchId;
    if (this.searching) {
      this.send('stop');
      await this.searching;
    }
    // Another search was requested meanwhile, or one started before us.
    if (id !== this.searchId || this.searching) return null;

    const limit = opts.elo != null;
    this.send(`setoption name MultiPV value ${opts.multipv || 1}`);
    this.send(`setoption name UCI_LimitStrength value ${limit}`);
    if (limit) this.send(`setoption name UCI_Elo value ${opts.elo}`);
    this.send(`setoption name Skill Level value ${opts.skill ?? 20}`);
    this.send(`position fen ${fen}`);

    let go = 'go';
    if (opts.depth) go += ` depth ${opts.depth}`;
    if (opts.movetime) go += ` movetime ${opts.movetime}`;
    if (!opts.depth && !opts.movetime) go += ' infinite';

    this._onInfo = onInfo || null;
    this.searching = new Promise((resolve) => { this._onBest = resolve; });
    this.send(go);

    const line = await this.searching;
    if (id !== this.searchId) return null;
    const m = line.match(/bestmove (\S+)(?: ponder (\S+))?/);
    if (!m || m[1] === '(none)') return { bestmove: null };
    return { bestmove: m[1], ponder: m[2] || null };
  }
}

export function parseInfo(line) {
  const t = line.split(' ');
  const info = { multipv: 1 };
  for (let i = 1; i < t.length; i++) {
    switch (t[i]) {
      case 'depth': info.depth = +t[++i]; break;
      case 'seldepth': info.seldepth = +t[++i]; break;
      case 'multipv': info.multipv = +t[++i]; break;
      case 'nodes': info.nodes = +t[++i]; break;
      case 'nps': info.nps = +t[++i]; break;
      case 'time': info.time = +t[++i]; break;
      case 'score':
        info.scoreType = t[++i]; // cp | mate
        info.score = +t[++i];
        if (t[i + 1] === 'lowerbound' || t[i + 1] === 'upperbound') info.bound = t[++i];
        break;
      case 'pv':
        info.pv = t.slice(i + 1);
        i = t.length;
        break;
    }
  }
  return info.pv && info.scoreType ? info : null;
}
