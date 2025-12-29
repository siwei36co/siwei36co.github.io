// tic-tac-toe.js
(function() {
    const boardEl = document.getElementById('ttt-board');
    const statusEl = document.getElementById('ttt-status');
    const modeEl = document.getElementById('ttt-mode');
    const newBtn = document.getElementById('ttt-new');

    if (!boardEl || !statusEl || !modeEl || !newBtn) return;

    const LINES = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
    ];

    let mode = modeEl.value; // "two" | "cpu"
    let cells = Array(9).fill(null);
    let current = 'X';
    let finished = false;

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

    function winnerInfo() {
        for (const line of LINES) {
            const [a, b, c] = line;
            if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
                return { winner: cells[a], line };
            }
        }
        if (cells.every(Boolean)) return { winner: null, line: null, draw: true };
        return null;
    }

    function setStatus() {
        const lang = getLang();
        const tr = t(lang);
        const info = winnerInfo();

        if (info && info.draw) {
            statusEl.textContent = tr.tttDraw || (lang === 'zh' ? '平局！' : 'Draw!');
            return;
        }

        if (info && info.winner) {
            statusEl.textContent = format(tr.tttWin || (lang === 'zh' ? '{player} 获胜！' : '{player} wins!'), { player: info.winner });
            return;
        }

        statusEl.textContent = format(tr.tttTurn || (lang === 'zh' ? '轮到 {player}' : 'Turn: {player}'), { player: current });
    }

    function renderBoard() {
        boardEl.innerHTML = '';
        for (let i = 0; i < 9; i++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ttt-cell';
            btn.dataset.index = String(i);
            btn.setAttribute('role', 'gridcell');
            btn.setAttribute('aria-label', `Cell ${i + 1}`);
            btn.textContent = cells[i] ? cells[i] : '';
            btn.disabled = finished || Boolean(cells[i]);
            btn.addEventListener('click', onCellClick);
            boardEl.appendChild(btn);
        }

        const info = winnerInfo();
        if (info && info.winner && info.line) {
            for (const idx of info.line) {
                const cellBtn = boardEl.querySelector(`.ttt-cell[data-index="${idx}"]`);
                if (cellBtn) cellBtn.classList.add('win');
            }
        }
    }

    function nextPlayer() {
        current = current === 'X' ? 'O' : 'X';
    }

    function startNewGame() {
        mode = modeEl.value;
        cells = Array(9).fill(null);
        current = 'X';
        finished = false;
        renderBoard();
        setStatus();
    }

    function applyMove(index, player) {
        if (finished) return false;
        if (cells[index]) return false;
        cells[index] = player;

        const info = winnerInfo();
        if (info && (info.winner || info.draw)) {
            finished = true;
        } else {
            nextPlayer();
        }

        renderBoard();
        setStatus();
        return true;
    }

    function chooseCpuMove() {
        const cpu = 'O';
        const human = 'X';

        // win
        for (const [a, b, c] of LINES) {
            const line = [a, b, c];
            const marks = line.map(i => cells[i]);
            if (marks.filter(m => m === cpu).length === 2 && marks.includes(null)) {
                return line[marks.indexOf(null)];
            }
        }

        // block
        for (const [a, b, c] of LINES) {
            const line = [a, b, c];
            const marks = line.map(i => cells[i]);
            if (marks.filter(m => m === human).length === 2 && marks.includes(null)) {
                return line[marks.indexOf(null)];
            }
        }

        // center
        if (!cells[4]) return 4;

        // corner
        const corners = [0, 2, 6, 8].filter(i => !cells[i]);
        if (corners.length) return corners[Math.floor(Math.random() * corners.length)];

        // any
        const empty = cells.map((v, i) => (v ? null : i)).filter(v => v != null);
        return empty.length ? empty[Math.floor(Math.random() * empty.length)] : null;
    }

    function maybeCpuTurn() {
        if (finished) return;
        if (mode !== 'cpu') return;
        if (current !== 'O') return;

        const move = chooseCpuMove();
        if (move == null) return;
        setTimeout(() => applyMove(move, 'O'), 120);
    }

    function onCellClick(e) {
        const idx = Number(e.currentTarget.dataset.index);
        if (!Number.isFinite(idx)) return;
        if (finished) return;

        if (mode === 'cpu' && current === 'O') return;

        const ok = applyMove(idx, current);
        if (ok) maybeCpuTurn();
    }

    modeEl.addEventListener('change', startNewGame);
    newBtn.addEventListener('click', startNewGame);

    document.addEventListener('languageChanged', () => setStatus());

    // Initial
    startNewGame();
})();

