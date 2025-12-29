// flappy-bird.js
(function() {
    const canvas = document.getElementById('flappy-canvas');
    const statusEl = document.getElementById('flappy-status');
    const startBtn = document.getElementById('flappy-start');
    const newBtn = document.getElementById('flappy-new');
    const scoreEl = document.getElementById('flappy-score');
    const bestEl = document.getElementById('flappy-best');

    if (!canvas || !statusEl || !startBtn || !newBtn || !scoreEl || !bestEl) return;
    const ctx = canvas.getContext('2d');

    const BEST_KEY = 'flappyBestScore';
    const W = canvas.width;
    const H = canvas.height;

    const birdX = 140;
    const gravity = 0.38;
    const flapV = -7.0;
    const pipeGap = 150;
    const pipeW = 76;
    const pipeSpeed = 2.8;
    const spawnEvery = 1400; // ms

    let running = false;
    let paused = false;
    let gameOver = false;
    let score = 0;
    let best = 0;

    let birdY = H / 2;
    let birdV = 0;

    let pipes = [];
    let lastSpawn = 0;
    let lastTs = 0;

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
        scoreEl.textContent = format(tr.scoreLabel || (lang === 'zh' ? '得分：{score}' : 'Score: {score}'), { score });
        bestEl.textContent = format(tr.bestLabel || (lang === 'zh' ? '最高分：{score}' : 'Best: {score}'), { score: best });
    }

    function updateButtons() {
        const lang = getLang();
        const tr = t(lang);
        if (!running) {
            startBtn.textContent = tr.start || (lang === 'zh' ? '开始' : 'Start');
        } else if (paused) {
            startBtn.textContent = tr.resume || (lang === 'zh' ? '继续' : 'Resume');
        } else {
            startBtn.textContent = tr.pause || (lang === 'zh' ? '暂停' : 'Pause');
        }
    }

    function setStatus(text) {
        statusEl.textContent = text;
    }

    function rand(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function spawnPipe(ts) {
        const margin = 60;
        const gapY = rand(margin + pipeGap / 2, H - margin - pipeGap / 2);
        pipes.push({
            x: W + 40,
            gapY,
            scored: false
        });
        lastSpawn = ts;
    }

    function reset() {
        running = false;
        paused = false;
        gameOver = false;
        score = 0;
        best = readBest();
        birdY = H / 2;
        birdV = 0;
        pipes = [];
        lastSpawn = 0;
        lastTs = 0;
        setHud();
        updateButtons();
        const lang = getLang();
        const tr = t(lang);
        setStatus(tr.flappyReady || (lang === 'zh' ? '准备就绪' : 'Ready'));
        draw();
    }

    function flap() {
        if (gameOver) return;
        if (!running) {
            running = true;
            paused = false;
            birdV = flapV;
            updateButtons();
            const lang = getLang();
            const tr = t(lang);
            setStatus(tr.flappyRunning || (lang === 'zh' ? '进行中' : 'Running'));
            return;
        }
        if (paused) return;
        birdV = flapV;
    }

    function togglePause() {
        if (!running || gameOver) return;
        paused = !paused;
        updateButtons();
        const lang = getLang();
        const tr = t(lang);
        setStatus(paused ? (tr.pause || (lang === 'zh' ? '暂停' : 'Pause')) : (tr.resume || (lang === 'zh' ? '继续' : 'Resume')));
    }

    function collide() {
        const birdR = 16;
        // ground / ceiling
        if (birdY + birdR >= H - 40) return true;
        if (birdY - birdR <= 0) return true;

        for (const p of pipes) {
            const px = p.x;
            if (birdX + birdR < px || birdX - birdR > px + pipeW) continue;
            const topH = p.gapY - pipeGap / 2;
            const botY = p.gapY + pipeGap / 2;
            if (birdY - birdR < topH || birdY + birdR > botY) return true;
        }
        return false;
    }

    function step(ts) {
        if (!running || paused || gameOver) return;
        const dt = Math.min(32, ts - (lastTs || ts));
        lastTs = ts;

        birdV += gravity * (dt / 16.67);
        birdY += birdV * (dt / 16.67);

        if (!lastSpawn || ts - lastSpawn >= spawnEvery) spawnPipe(ts);

        for (const p of pipes) {
            p.x -= pipeSpeed * (dt / 16.67);
            if (!p.scored && p.x + pipeW < birdX) {
                p.scored = true;
                score += 1;
                if (score > best) {
                    best = score;
                    writeBest(best);
                }
                setHud();
            }
        }
        pipes = pipes.filter(p => p.x + pipeW > -80);

        if (collide()) {
            gameOver = true;
            running = false;
            updateButtons();
            const lang = getLang();
            const tr = t(lang);
            setStatus(tr.gameOver || (lang === 'zh' ? '游戏结束' : 'Game Over'));
        }
    }

    function draw() {
        const isDark = document.body.classList.contains('dark-theme');
        ctx.clearRect(0, 0, W, H);

        // sky
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, isDark ? '#2c3e50' : '#74b9ff');
        sky.addColorStop(1, isDark ? '#34495e' : '#a29bfe');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);

        // ground
        ctx.fillStyle = isDark ? '#2d3436' : '#55efc4';
        ctx.fillRect(0, H - 40, W, 40);

        // pipes
        for (const p of pipes) {
            const topH = p.gapY - pipeGap / 2;
            const botY = p.gapY + pipeGap / 2;
            ctx.fillStyle = isDark ? '#10b981' : '#00b894';
            ctx.fillRect(p.x, 0, pipeW, topH);
            ctx.fillRect(p.x, botY, pipeW, (H - 40) - botY);
            // pipe lip
            ctx.fillStyle = isDark ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.10)';
            ctx.fillRect(p.x - 4, topH - 12, pipeW + 8, 12);
            ctx.fillRect(p.x - 4, botY, pipeW + 8, 12);
        }

        // bird
        const birdR = 16;
        ctx.save();
        ctx.translate(birdX, birdY);
        ctx.rotate(Math.max(-0.35, Math.min(0.55, birdV / 14)));
        ctx.fillStyle = '#fdcb6e';
        ctx.beginPath();
        ctx.arc(0, 0, birdR, 0, Math.PI * 2);
        ctx.fill();
        // eye
        ctx.fillStyle = '#2d3436';
        ctx.beginPath();
        ctx.arc(6, -5, 3, 0, Math.PI * 2);
        ctx.fill();
        // beak
        ctx.fillStyle = '#e17055';
        ctx.beginPath();
        ctx.moveTo(12, 2);
        ctx.lineTo(24, 6);
        ctx.lineTo(12, 10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // score text
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.font = '700 28px Poppins, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(String(score), W / 2, 14);

        if (!running && !gameOver) {
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#ffffff';
            ctx.font = '700 22px Poppins, sans-serif';
            const lang = getLang();
            const tr = t(lang);
            ctx.fillText(tr.flappyTapToStart || (lang === 'zh' ? '点击/空格开始' : 'Click/Space to start'), W / 2, H / 2 - 10);
        }

        if (gameOver) {
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#ffffff';
            ctx.font = '700 28px Poppins, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const lang = getLang();
            const tr = t(lang);
            ctx.fillText(tr.gameOver || (lang === 'zh' ? '游戏结束' : 'Game Over'), W / 2, H / 2 - 16);
            ctx.font = '600 18px Poppins, sans-serif';
            ctx.fillText(tr.flappyRestartHint || (lang === 'zh' ? '点击新游戏重新开始' : 'Press New Game to restart'), W / 2, H / 2 + 18);
        }
    }

    function loop(ts) {
        step(ts);
        draw();
        requestAnimationFrame(loop);
    }

    canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        flap();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            flap();
        } else if (e.key === 'p' || e.key === 'P') {
            togglePause();
        }
    });

    startBtn.addEventListener('click', () => {
        if (gameOver) return;
        if (!running) {
            flap();
        } else {
            togglePause();
        }
    });

    newBtn.addEventListener('click', reset);
    document.addEventListener('languageChanged', () => {
        setHud();
        updateButtons();
        if (gameOver) return;
        const lang = getLang();
        const tr = t(lang);
        if (!running) setStatus(tr.flappyReady || (lang === 'zh' ? '准备就绪' : 'Ready'));
    });

    reset();
    requestAnimationFrame(loop);
})();
