// 2048-anim.js (with animations, undo, hint)
(function() {
    const boardEl = document.getElementById('g2048-board');
    const tilesEl = document.getElementById('g2048-tiles');
    const hintArrowEl = document.getElementById('g2048-hint-arrow');
    const scoreEl = document.getElementById('g2048-score');
    const bestEl = document.getElementById('g2048-best');
    const movesEl = document.getElementById('g2048-moves');
    const maxEl = document.getElementById('g2048-max');
    const statusEl = document.getElementById('g2048-status');
    const newBtn = document.getElementById('g2048-new');
    const undoBtn = document.getElementById('g2048-undo');
    const hintBtn = document.getElementById('g2048-hint');

    const overlayEl = document.getElementById('g2048-overlay');
    const overlayTitleEl = document.getElementById('g2048-overlay-title');
    const overlayBodyEl = document.getElementById('g2048-overlay-body');
    const keepBtn = document.getElementById('g2048-keep');
    const restartBtn = document.getElementById('g2048-restart');

    if (!boardEl || !tilesEl || !hintArrowEl || !scoreEl || !bestEl || !movesEl || !maxEl || !statusEl || !newBtn || !undoBtn || !hintBtn || !overlayEl || !overlayTitleEl || !overlayBodyEl || !keepBtn || !restartBtn) {
        return;
    }

    const SIZE = 4;
    const BEST_KEY = 'g2048BestScore';
    const MOVE_MS = 140;
    const HISTORY_LIMIT = 60;

    let nextId = 1;
    let tiles = new Map(); // id -> {id,value,r,c}
    let grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null)); // id|null

    let score = 0;
    let won = false;
    let allowContinueAfterWin = false;
    let moves = 0;

    let history = [];
    let touchStart = null;
    const tileEls = new Map(); // id -> element
    let hintTimer = null;

    function getLang() {
        const stored = localStorage.getItem('language');
        const nav = (navigator.language || navigator.userLanguage || 'en').split('-')[0];
        const lang = stored || nav;
        return ['zh', 'en'].includes(lang) ? lang : 'en';
    }

    function t(lang) {
        if (typeof getTranslationsForLang === 'function') return getTranslationsForLang(lang);
        return {};
    }

    function format(str, vars) {
        return String(str).replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] != null ? String(vars[k]) : `{${k}}`));
    }

    function readBest() {
        const n = Number(localStorage.getItem(BEST_KEY) || '0');
        return Number.isFinite(n) ? n : 0;
    }

    function writeBest(n) {
        localStorage.setItem(BEST_KEY, String(n));
    }

    function setHud() {
        const lang = getLang();
        const tr = t(lang);
        const best = readBest();
        let maxTile = 0;
        for (const tile of tiles.values()) {
            if (tile.value > maxTile) maxTile = tile.value;
        }
        scoreEl.textContent = format(tr.scoreLabel || (lang === 'zh' ? '得分：{score}' : 'Score: {score}'), { score });
        bestEl.textContent = format(tr.bestLabel || (lang === 'zh' ? '最高分：{score}' : 'Best: {score}'), { score: best });
        movesEl.textContent = format(tr.movesLabel || (lang === 'zh' ? '步数：{moves}' : 'Moves: {moves}'), { moves });
        maxEl.textContent = format(tr.maxTileLabel || (lang === 'zh' ? '最大：{tile}' : 'Max: {tile}'), { tile: maxTile || 0 });
    }

    function setUndoState() {
        undoBtn.disabled = history.length === 0;
    }

    function showOverlay(kind) {
        const lang = getLang();
        const tr = t(lang);

        if (kind === 'win') {
            overlayTitleEl.textContent = tr.g2048WinTitle || (lang === 'zh' ? '你达到了 2048！' : 'You reached 2048!');
            overlayBodyEl.textContent = tr.g2048WinBody || (lang === 'zh' ? '继续挑战更高分，或者重新开始。' : 'Keep going for a higher score, or restart.');
            keepBtn.style.display = '';
        } else {
            overlayTitleEl.textContent = tr.g2048GameOverTitle || (lang === 'zh' ? '游戏结束' : 'Game Over');
            overlayBodyEl.textContent = tr.g2048GameOverBody || (lang === 'zh' ? '没有可移动的方向了。' : 'No more moves left.');
            keepBtn.style.display = 'none';
        }

        overlayEl.classList.add('show');
    }

    function hideOverlay() {
        overlayEl.classList.remove('show');
    }

    function clearHintUi() {
        boardEl.classList.remove('hint', 'hint-up', 'hint-down', 'hint-left', 'hint-right');
        if (hintTimer) {
            clearTimeout(hintTimer);
            hintTimer = null;
        }
    }

    function computeLayout() {
        const style = getComputedStyle(boardEl);
        const pad = parseFloat(style.paddingLeft) || 0;
        const gap = parseFloat(style.gap) || 0;
        const inner = boardEl.clientWidth - pad * 2;
        const size = (inner - gap * (SIZE - 1)) / SIZE;
        return { pad, gap, size };
    }

    function ensureTileEl(id) {
        let el = tileEls.get(id);
        if (el) return el;
        el = document.createElement('div');
        el.className = 'g2048-tile';
        el.dataset.id = String(id);
        const inner = document.createElement('div');
        inner.className = 'g2048-tile-inner';
        el.appendChild(inner);
        tilesEl.appendChild(el);
        tileEls.set(id, el);
        return el;
    }

    function tileClass(value) {
        if (value <= 2048) return `g2048-${value}`;
        return 'g2048-big';
    }

    function render(opts) {
        const { animate, spawnIds, mergeIds, vanishIds } = opts || {};
        const { pad, gap, size } = computeLayout();

        for (const [id, el] of tileEls.entries()) {
            if (!tiles.has(id)) {
                el.remove();
                tileEls.delete(id);
            }
        }

        for (const tile of tiles.values()) {
            const el = ensureTileEl(tile.id);
            el.style.width = `${size}px`;
            el.style.height = `${size}px`;
            const x = pad + tile.c * (size + gap);
            const y = pad + tile.r * (size + gap);
            el.style.transform = `translate(${x}px, ${y}px)`;

            const cls = [`g2048-tile`];
            if (spawnIds && spawnIds.includes(tile.id)) cls.push('spawn');
            if (mergeIds && mergeIds.includes(tile.id)) cls.push('merge');
            if (vanishIds && vanishIds.includes(tile.id)) cls.push('vanish');
            el.className = cls.join(' ');

            const inner = el.firstElementChild;
            if (inner) {
                inner.className = `g2048-tile-inner ${tileClass(tile.value)}`;
                inner.textContent = String(tile.value);
            }
        }

        if (animate) {
            // eslint-disable-next-line no-unused-expressions
            boardEl.offsetHeight;
        }
    }

    function emptyCells() {
        const cells = [];
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (grid[r][c] == null) cells.push({ r, c });
        return cells;
    }

    function spawnTile(value, forcedPos) {
        const empties = emptyCells();
        if (!empties.length && !forcedPos) return null;
        const pick = forcedPos || empties[Math.floor(Math.random() * empties.length)];
        const id = nextId++;
        tiles.set(id, { id, value, r: pick.r, c: pick.c });
        grid[pick.r][pick.c] = id;
        return id;
    }

    function snapshot() {
        const values = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                const id = grid[r][c];
                values[r][c] = id == null ? 0 : tiles.get(id).value;
            }
        }
        return { values, score, won, allowContinueAfterWin, moves };
    }

    function restore(snap) {
        tiles.clear();
        grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
        for (const el of tileEls.values()) el.remove();
        tileEls.clear();

        score = snap.score;
        won = snap.won;
        allowContinueAfterWin = snap.allowContinueAfterWin;
        moves = snap.moves;

        nextId = 1;
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (snap.values[r][c]) spawnTile(snap.values[r][c], { r, c });

        hideOverlay();
        statusEl.textContent = '';
        render({ animate: false });
        setHud();
        setUndoState();
    }

    function pushHistory() {
        history.push(snapshot());
        if (history.length > HISTORY_LIMIT) history.shift();
        setUndoState();
    }

    function undo() {
        if (!history.length) return;
        restore(history.pop());
    }

    function simulateMove(values, dir) {
        const out = values.map(row => row.slice());
        let moved = false;
        let gain = 0;

        const readLine = (i) => {
            if (dir === 'left') return out[i].slice();
            if (dir === 'right') return out[i].slice().reverse();
            if (dir === 'up') return out.map(row => row[i]);
            return out.map(row => row[i]).reverse();
        };
        const writeLine = (i, line) => {
            if (dir === 'left') out[i] = line.slice();
            else if (dir === 'right') out[i] = line.slice().reverse();
            else if (dir === 'up') for (let r = 0; r < SIZE; r++) out[r][i] = line[r];
            else {
                const rev = line.slice().reverse();
                for (let r = 0; r < SIZE; r++) out[r][i] = rev[r];
            }
        };
        const moveLine = (line) => {
            const filtered = line.filter(n => n !== 0);
            const merged = [];
            for (let i = 0; i < filtered.length; i++) {
                if (filtered[i] && filtered[i] === filtered[i + 1]) {
                    const v = filtered[i] * 2;
                    merged.push(v);
                    gain += v;
                    i++;
                } else merged.push(filtered[i]);
            }
            while (merged.length < SIZE) merged.push(0);
            return merged;
        };

        for (let i = 0; i < SIZE; i++) {
            const before = readLine(i);
            const after = moveLine(before);
            if (before.some((v, idx) => v !== after[idx])) moved = true;
            writeLine(i, after);
        }

        let empty = 0;
        let maxTile = 0;
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
            if (out[r][c] === 0) empty++;
            if (out[r][c] > maxTile) maxTile = out[r][c];
        }

        return { moved, gain, empty, maxTile, out };
    }

    function evalGrid(values) {
        const log2 = (v) => (v > 0 ? Math.log2(v) : 0);
        let empty = 0;
        let maxTile = 0;
        let smooth = 0;
        let mono = 0;

        const vLog = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                const v = values[r][c];
                if (!v) empty++;
                if (v > maxTile) maxTile = v;
                vLog[r][c] = log2(v);
            }
        }

        // smoothness: adjacent differences
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                const v = vLog[r][c];
                if (!v) continue;
                if (r + 1 < SIZE && vLog[r + 1][c]) smooth -= Math.abs(v - vLog[r + 1][c]);
                if (c + 1 < SIZE && vLog[r][c + 1]) smooth -= Math.abs(v - vLog[r][c + 1]);
            }
        }

        // monotonicity (encourage rows/cols to be monotonic)
        for (let r = 0; r < SIZE; r++) {
            let inc = 0;
            let dec = 0;
            for (let c = 0; c < SIZE - 1; c++) {
                const a = vLog[r][c];
                const b = vLog[r][c + 1];
                if (a > b) dec += a - b;
                else inc += b - a;
            }
            mono -= Math.min(inc, dec);
        }
        for (let c = 0; c < SIZE; c++) {
            let inc = 0;
            let dec = 0;
            for (let r = 0; r < SIZE - 1; r++) {
                const a = vLog[r][c];
                const b = vLog[r + 1][c];
                if (a > b) dec += a - b;
                else inc += b - a;
            }
            mono -= Math.min(inc, dec);
        }

        // put max tile in a corner (soft preference)
        const corners = [values[0][0], values[0][SIZE - 1], values[SIZE - 1][0], values[SIZE - 1][SIZE - 1]];
        const cornerBonus = corners.includes(maxTile) ? 1 : 0;

        return { empty, maxTile, smooth, mono, cornerBonus };
    }

    function bestHint() {
        const values = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) values[r][c] = grid[r][c] == null ? 0 : tiles.get(grid[r][c]).value;

        const dirs = ['up', 'right', 'down', 'left'];
        let best = null;
        for (const d of dirs) {
            const sim = simulateMove(values, d);
            if (!sim.moved) continue;
            const e = evalGrid(sim.out);
            // heuristic weights tuned for "playability"
            const score =
                e.empty * 2.6 +
                sim.gain * 0.08 +
                e.smooth * 0.25 +
                e.mono * 0.75 +
                e.cornerBonus * 1.2 +
                Math.log2(Math.max(2, e.maxTile)) * 0.15;
            if (!best || score > best.score) best = { dir: d, score };
        }
        return best;
    }

    function showHint() {
        const lang = getLang();
        const tr = t(lang);
        const hint = bestHint();
        clearHintUi();
        if (!hint) {
            statusEl.textContent = tr.hintNoMoves || (lang === 'zh' ? '提示：没有可移动的方向' : 'Hint: no moves');
            return;
        }
        const dirKey = `hintDir_${hint.dir}`;
        const dirLabel =
            tr[dirKey] ||
            (hint.dir === 'up' ? (lang === 'zh' ? '上' : 'Up') :
             hint.dir === 'down' ? (lang === 'zh' ? '下' : 'Down') :
             hint.dir === 'left' ? (lang === 'zh' ? '左' : 'Left') :
             (lang === 'zh' ? '右' : 'Right'));
        statusEl.textContent = format(tr.hintTryDirection || (lang === 'zh' ? '提示：试试 {dir}' : 'Hint: try {dir}'), { dir: dirLabel });

        boardEl.classList.add('hint', `hint-${hint.dir}`);
        hintTimer = setTimeout(() => clearHintUi(), 1600);
    }

    function canMoveValues(values) {
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (values[r][c] === 0) return true;
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
            const v = values[r][c];
            if (r + 1 < SIZE && values[r + 1][c] === v) return true;
            if (c + 1 < SIZE && values[r][c + 1] === v) return true;
        }
        return false;
    }

    function move(dir) {
        let moved = false;
        let gained = 0;
        const spawnIds = [];
        const mergeIds = [];
        const vanishIds = [];

        const beforeGrid = grid.map(row => row.slice());
        const newGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

        const cellPos = (lineIndex, writeIndex) => {
            let r = lineIndex, c = writeIndex;
            if (dir === 'right') c = SIZE - 1 - writeIndex;
            if (dir === 'up') { r = writeIndex; c = lineIndex; }
            if (dir === 'down') { r = SIZE - 1 - writeIndex; c = lineIndex; }
            return { r, c };
        };

        const getLine = (i) => {
            const ids = [];
            for (let k = 0; k < SIZE; k++) {
                const { r, c } = cellPos(i, k);
                const id = grid[r][c];
                if (id != null) ids.push(id);
            }
            return ids;
        };

        for (let i = 0; i < SIZE; i++) {
            const line = getLine(i);
            const out = [];
            let k = 0;
            while (k < line.length) {
                const a = line[k];
                const b = line[k + 1];
                if (b != null && tiles.get(a).value === tiles.get(b).value) {
                    out.push({ kind: 'merge', a, b, value: tiles.get(a).value * 2 });
                    gained += tiles.get(a).value * 2;
                    k += 2;
                } else {
                    out.push({ kind: 'move', id: a });
                    k += 1;
                }
            }

            let write = 0;
            for (const item of out) {
                const { r, c } = cellPos(i, write);
                if (item.kind === 'move') {
                    newGrid[r][c] = item.id;
                    const t0 = tiles.get(item.id);
                    t0.r = r; t0.c = c;
                    write++;
                } else {
                    const newId = nextId++;
                    tiles.set(newId, { id: newId, value: item.value, r, c });
                    newGrid[r][c] = newId;

                    // animate old tiles into target then remove
                    const ta = tiles.get(item.a);
                    const tb = tiles.get(item.b);
                    ta.r = r; ta.c = c;
                    tb.r = r; tb.c = c;
                    vanishIds.push(item.a, item.b);
                    mergeIds.push(newId);
                    write++;
                }
            }
        }

        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (beforeGrid[r][c] !== newGrid[r][c]) moved = true;
        if (!moved) {
            for (const id of mergeIds) tiles.delete(id);
            return { moved: false };
        }

        grid = newGrid;

        setTimeout(() => {
            for (const id of vanishIds) {
                const el = tileEls.get(id);
                if (el) el.remove();
                tileEls.delete(id);
                tiles.delete(id);
            }
        }, MOVE_MS + 40);

        const empties = emptyCells();
        if (empties.length) {
            const value = Math.random() < 0.9 ? 2 : 4;
            const id = spawnTile(value);
            if (id != null) spawnIds.push(id);
        }

        for (const tile of tiles.values()) if (tile.value === 2048) won = true;
        return { moved: true, gained, spawnIds, mergeIds, vanishIds };
    }

    function applyMove(dir) {
        if (overlayEl.classList.contains('show') && won && !allowContinueAfterWin) return;
        clearHintUi();
        const snap = snapshot();
        const res = move(dir);
        if (!res.moved) return;

        history.push(snap);
        if (history.length > HISTORY_LIMIT) history.shift();
        setUndoState();
        moves += 1;
        score += res.gained;
        if (score > readBest()) writeBest(score);

        render({ animate: true, spawnIds: res.spawnIds, mergeIds: res.mergeIds, vanishIds: res.vanishIds });
        setHud();
        setUndoState();

        if (res.gained) {
            statusEl.textContent = `+${res.gained}`;
            setTimeout(() => {
                if (statusEl.textContent === `+${res.gained}`) statusEl.textContent = '';
            }, 500);
        }

        if (won && !allowContinueAfterWin) showOverlay('win');
        else {
            const values = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
            for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) values[r][c] = grid[r][c] == null ? 0 : tiles.get(grid[r][c]).value;
            if (!canMoveValues(values)) showOverlay('lose');
        }
    }

    function startNewGame() {
        history = [];
        setUndoState();
        tiles.clear();
        grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
        for (const el of tileEls.values()) el.remove();
        tileEls.clear();
        nextId = 1;

        score = 0;
        moves = 0;
        won = false;
        allowContinueAfterWin = false;
        hideOverlay();
        statusEl.textContent = '';

        spawnTile(Math.random() < 0.9 ? 2 : 4);
        spawnTile(Math.random() < 0.9 ? 2 : 4);
        render({ animate: false });
        setHud();
    }

    function onKeyDown(e) {
        const key = e.key;
        if (key === 'ArrowUp' || key === 'w' || key === 'W') { e.preventDefault(); applyMove('up'); }
        else if (key === 'ArrowDown' || key === 's' || key === 'S') { e.preventDefault(); applyMove('down'); }
        else if (key === 'ArrowLeft' || key === 'a' || key === 'A') { e.preventDefault(); applyMove('left'); }
        else if (key === 'ArrowRight' || key === 'd' || key === 'D') { e.preventDefault(); applyMove('right'); }
        else if (key === 'r' || key === 'R') startNewGame();
        else if (key === 'z' || key === 'Z') undo();
        else if (key === 'h' || key === 'H') showHint();
    }

    function onTouchStart(e) {
        const t0 = e.touches && e.touches[0];
        if (!t0) return;
        touchStart = { x: t0.clientX, y: t0.clientY };
    }

    function onTouchEnd(e) {
        if (!touchStart) return;
        const t1 = e.changedTouches && e.changedTouches[0];
        if (!t1) return;
        const dx = t1.clientX - touchStart.x;
        const dy = t1.clientY - touchStart.y;
        touchStart = null;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        if (Math.max(adx, ady) < 28) return;
        if (adx > ady) applyMove(dx > 0 ? 'right' : 'left');
        else applyMove(dy > 0 ? 'down' : 'up');
    }

    newBtn.addEventListener('click', startNewGame);
    undoBtn.addEventListener('click', undo);
    hintBtn.addEventListener('click', showHint);
    restartBtn.addEventListener('click', startNewGame);
    keepBtn.addEventListener('click', () => {
        allowContinueAfterWin = true;
        hideOverlay();
    });

    boardEl.addEventListener('touchstart', onTouchStart, { passive: true });
    boardEl.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('languageChanged', () => {
        setHud();
        setUndoState();
    });

    window.addEventListener('resize', () => render({ animate: false }));

    startNewGame();
})();
