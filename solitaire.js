// solitaire.js (Klondike-lite, click-to-move)
(function() {
    const stockEl = document.getElementById('sol-stock');
    const wasteEl = document.getElementById('sol-waste');
    const tableauEl = document.getElementById('sol-tableau');
    const statusEl = document.getElementById('sol-status');
    const newBtn = document.getElementById('sol-new');
    const undoBtn = document.getElementById('sol-undo');
    const hintBtn = document.getElementById('sol-hint');
    const autoBtn = document.getElementById('sol-auto');
    const guideBtn = document.getElementById('sol-guide');
    const scoreEl = document.getElementById('sol-score');
    const movesEl = document.getElementById('sol-moves');
    const foundationEls = [
        document.getElementById('sol-foundation-0'),
        document.getElementById('sol-foundation-1'),
        document.getElementById('sol-foundation-2'),
        document.getElementById('sol-foundation-3')
    ];

    if (!stockEl || !wasteEl || !tableauEl || !statusEl || !newBtn || !undoBtn || !hintBtn || !autoBtn || !guideBtn || !scoreEl || !movesEl || foundationEls.some(el => !el)) return;

    const TUTORIAL_SEEN_KEY = 'solitaireTutorialSeen';
    const tutorialEl = document.getElementById('sol-tutorial');
    const tutorialPopoverEl = document.getElementById('sol-tutorial-popover');
    const tutorialStepEl = document.getElementById('sol-tutorial-step');
    const tutorialDontShowEl = document.getElementById('sol-tutorial-dontshow');
    const tutorialSkipBtn = document.getElementById('sol-tutorial-skip');
    const tutorialBackBtn = document.getElementById('sol-tutorial-back');
    const tutorialNextBtn = document.getElementById('sol-tutorial-next');

    const tutorial = {
        open: false,
        mode: null, // null -> pick mode, 'tour' -> quick tour, 'practice' -> step-by-step practice
        step: 0,
        stepsTour: [
            { key: 'solTutWelcome', targets: [] },
            { key: 'solTutStock', targets: ['#sol-stock'] },
            { key: 'solTutWaste', targets: ['#sol-waste'] },
            { key: 'solTutFoundations', targets: ['#sol-foundation-0'] },
            { key: 'solTutTableau', targets: ['#sol-tableau'] },
            { key: 'solTutTip', targets: ['#sol-hint'] }
        ],
        stepsPractice: [
            { key: 'solPracIntro', targets: [], kind: 'intro' },
            { key: 'solPracDraw', targets: ['#sol-stock'], expect: 'draw' },
            { key: 'solPracMoveWaste', targets: ['#sol-waste', '.sol-col[data-col="0"]'], expect: 'moveWasteToCol0' },
            { key: 'solPracFlip', targets: ['.sol-col[data-col="1"]'], expect: 'flipCol1Top' },
            { key: 'solPracFoundation', targets: ['#sol-foundation-0', '#sol-foundation-1', '#sol-foundation-2', '#sol-foundation-3'], expect: 'moveADiamondToFoundation' },
            { key: 'solPracHint', targets: ['#sol-hint'], expect: 'hint' },
            { key: 'solPracDone', targets: [], kind: 'done' }
        ]
    };
    let tutorialRepositionRaf = null;
    const practice = {
        active: false,
        expected: null,
        saved: null,
        savedBodyOverflow: null
    };

    // Demo overlay (video-like playback)
    const demoBtn = document.getElementById('sol-demo');
    const demoOverlayEl = document.getElementById('sol-demo-overlay');
    const demoCaptionEl = document.getElementById('sol-demo-caption');
    const demoExitBtn = document.getElementById('sol-demo-exit');
    const demoPauseBtn = document.getElementById('sol-demo-pause');
    const demoPlayBtn = document.getElementById('sol-demo-play');

    const demo = {
        active: false,
        paused: false,
        token: 0,
        caption: null // { key, fallback }
    };
    let demoSaved = null;
    let demoSavedBodyOverflow = null;

    const SUITS = ['♠', '♥', '♦', '♣'];
    const SUIT_COLOR = {
        '♠': 'black',
        '♣': 'black',
        '♥': 'red',
        '♦': 'red'
    };

    let stock = [];
    let waste = [];
    let foundations = [[], [], [], []];
    let tableau = Array.from({ length: 7 }, () => []);

    // selection: { from: 'waste' } or { from:'tableau', col, index }
    let selection = null;
    let score = 0;
    let moves = 0;
    let history = [];
    const HISTORY_LIMIT = 80;
    let hint = null; // { sourceId, target: {type, index} }
    let lastMovedCardId = null;
    let lastMove = null; // { type, cardId?, fromCol?, toCol?, revealed?, emptied? }
    let suppressClickUntil = 0;

    const dragState = {
        pending: null, // {source:'waste'|'tableau', col?, index?, pointerId, startX, startY, originRect}
        active: false,
        pointerId: null,
        offsetX: 0,
        offsetY: 0,
        target: null, // {type:'tableau'|'foundation', index}
        validTableau: null, // Set<number>
        validFoundations: null, // Set<number>
        layer: null,
        cards: [] // { card, el, dx, dy }
    };

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

    function tt(key, fallback) {
        const lang = getLang();
        const tr = t(lang);
        return tr[key] || fallback || key;
    }

    function cardLabel(card) {
        if (!card) return '';
        return `${rankLabel(card.rank)}${card.suit}`;
    }

    function tableauTargetLabel(col) {
        const pile = tableau[col];
        const t0 = top(pile);
        if (!t0) return tt('solEmptyColumn', getLang() === 'zh' ? '空列' : 'Empty column');
        if (!t0.faceUp) return tt('solFaceDown', getLang() === 'zh' ? '暗牌' : 'Face-down');
        return cardLabel(t0);
    }

    function setStatus(text) {
        statusEl.textContent = text || '';
    }

    function setHud() {
        const lang = getLang();
        const tr = t(lang);
        scoreEl.textContent = format(tr.scoreLabel || (lang === 'zh' ? '得分：{score}' : 'Score: {score}'), { score });
        movesEl.textContent = format(tr.movesLabel || (lang === 'zh' ? '步数：{moves}' : 'Moves: {moves}'), { moves });
    }

    function setDemoUi(open) {
        if (!demoOverlayEl || !demoCaptionEl || !demoExitBtn || !demoPauseBtn || !demoPlayBtn) return;
        demoOverlayEl.hidden = !open;
        demoOverlayEl.setAttribute('aria-hidden', open ? 'false' : 'true');
    }

    function setDemoCaption(key, fallback) {
        if (!demoCaptionEl) return;
        demo.caption = { key, fallback: fallback || '' };
        demoCaptionEl.textContent = tt(key, fallback || '');
    }

    function setDemoPaused(paused) {
        demo.paused = paused;
        if (!demoPauseBtn || !demoPlayBtn) return;
        demoPauseBtn.hidden = paused;
        demoPlayBtn.hidden = !paused;
    }

    function captureDemoSnapshot() {
        const clonePile = (pile) => pile.map(c => ({ ...c }));
        const clonePiles = (piles) => piles.map(p => clonePile(p));
        const cloneHistory = (h) => ({
            stock: clonePile(h.stock || []),
            waste: clonePile(h.waste || []),
            foundations: clonePiles(h.foundations || [[], [], [], []]),
            tableau: clonePiles(h.tableau || Array.from({ length: 7 }, () => [])),
            score: h.score || 0,
            moves: h.moves || 0
        });

        return {
            stock: clonePile(stock),
            waste: clonePile(waste),
            foundations: clonePiles(foundations),
            tableau: clonePiles(tableau),
            score,
            moves,
            selection: selection ? { ...selection } : null,
            hint: hint ? { sourceId: hint.sourceId, target: hint.target ? { ...hint.target } : null } : null,
            lastMovedCardId,
            suppressClickUntil,
            status: statusEl.textContent || '',
            history: history.map(cloneHistory),
            controls: {
                newDisabled: !!newBtn.disabled,
                undoDisabled: !!undoBtn.disabled,
                hintDisabled: !!hintBtn.disabled,
                autoDisabled: !!autoBtn.disabled,
                guideDisabled: !!guideBtn.disabled,
                demoDisabled: !!(demoBtn && demoBtn.disabled)
            }
        };
    }

    function restoreDemoSnapshot(saved) {
        if (!saved) return;
        const clonePile = (pile) => pile.map(c => ({ ...c }));
        const clonePiles = (piles) => piles.map(p => clonePile(p));
        const cloneHistory = (h) => ({
            stock: clonePile(h.stock || []),
            waste: clonePile(h.waste || []),
            foundations: clonePiles(h.foundations || [[], [], [], []]),
            tableau: clonePiles(h.tableau || Array.from({ length: 7 }, () => [])),
            score: h.score || 0,
            moves: h.moves || 0
        });

        stock = clonePile(saved.stock || []);
        waste = clonePile(saved.waste || []);
        foundations = clonePiles(saved.foundations || [[], [], [], []]);
        tableau = clonePiles(saved.tableau || Array.from({ length: 7 }, () => []));
        score = saved.score || 0;
        moves = saved.moves || 0;
        selection = saved.selection ? { ...saved.selection } : null;
        hint = saved.hint ? { sourceId: saved.hint.sourceId, target: saved.hint.target ? { ...saved.hint.target } : null } : null;
        lastMovedCardId = saved.lastMovedCardId != null ? saved.lastMovedCardId : null;
        suppressClickUntil = saved.suppressClickUntil || 0;
        history = (saved.history || []).map(cloneHistory);

        newBtn.disabled = !!(saved.controls && saved.controls.newDisabled);
        undoBtn.disabled = !!(saved.controls && saved.controls.undoDisabled);
        hintBtn.disabled = !!(saved.controls && saved.controls.hintDisabled);
        autoBtn.disabled = !!(saved.controls && saved.controls.autoDisabled);
        guideBtn.disabled = !!(saved.controls && saved.controls.guideDisabled);
        if (demoBtn) demoBtn.disabled = !!(saved.controls && saved.controls.demoDisabled);

        setHud();
        setStatus(saved.status || '');
        render();
    }

    function enforceDemoControls() {
        newBtn.disabled = true;
        undoBtn.disabled = true;
        hintBtn.disabled = true;
        autoBtn.disabled = true;
        guideBtn.disabled = true;
        if (demoBtn) demoBtn.disabled = true;
    }

    function stopDemo({ restoreState } = {}) {
        const shouldRestore = restoreState !== false;
        demo.token += 1;
        demo.active = false;
        setDemoUi(false);
        setDemoPaused(false);
        clearDemoHighlight();

        if (demoSavedBodyOverflow != null) {
            document.body.style.overflow = demoSavedBodyOverflow;
            demoSavedBodyOverflow = null;
        }

        if (shouldRestore && demoSaved) {
            restoreDemoSnapshot(demoSaved);
        }
        demoSaved = null;
    }

    function demoSleep(ms) {
        const myToken = demo.token;
        return new Promise((resolve) => {
            let last = performance.now();
            let remaining = ms;
            function tick(now) {
                if (demo.token !== myToken) return resolve();
                if (demo.paused) {
                    last = now;
                    return requestAnimationFrame(tick);
                }
                const dt = now - last;
                last = now;
                remaining -= dt;
                if (remaining <= 0) return resolve();
                requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
        });
    }

    function clearDemoHighlight() {
        document.querySelectorAll('.sol-demo-highlight').forEach(el => el.classList.remove('sol-demo-highlight'));
    }

    function demoHighlight(selector) {
        clearDemoHighlight();
        if (!selector) return null;
        const el = document.querySelector(selector);
        if (el) el.classList.add('sol-demo-highlight');
        return el;
    }

    function getCardElById(id) {
        return document.querySelector(`.sol-card[data-card-id="${id}"]:not(.dragging)`);
    }

    function createDemoLayer() {
        const layer = document.createElement('div');
        layer.className = 'sol-drag-layer';
        document.body.appendChild(layer);
        return layer;
    }

    function animMoveElements(elements, fromRect, toRect, dyStep, durationMs) {
        const layer = createDemoLayer();
        const clones = [];
        for (let i = 0; i < elements.length; i++) {
            const el = renderCard(elements[i], {});
            el.classList.add('dragging');
            el.style.position = 'fixed';
            el.style.left = `${fromRect.left}px`;
            el.style.top = `${fromRect.top + i * dyStep}px`;
            el.style.transform = 'none';
            el.style.transition = `left ${durationMs}ms ease-out, top ${durationMs}ms ease-out`;
            el.style.zIndex = String(14000 + i);
            layer.appendChild(el);
            clones.push(el);
        }
        // kick animation
        requestAnimationFrame(() => {
            for (let i = 0; i < clones.length; i++) {
                clones[i].style.left = `${toRect.left}px`;
                clones[i].style.top = `${toRect.top + i * dyStep}px`;
            }
        });
        return demoSleep(durationMs + 80).then(() => layer.remove());
    }

    function tableauDropRect(col) {
        const slot = tableauEl.querySelector(`.sol-slot[data-col="${col}"]`);
        const pile = tableau[col];
        if (pile && pile.length) {
            const t0 = top(pile);
            const el = getCardElById(t0.id);
            if (el) {
                const r = el.getBoundingClientRect();
                return { left: r.left, top: r.top + 22 };
            }
        }
        if (slot) {
            const r = slot.getBoundingClientRect();
            return { left: r.left, top: r.top };
        }
        return { left: window.innerWidth / 2, top: window.innerHeight / 2 };
    }

    function foundationRect(i) {
        const el = foundationEls[i];
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top };
    }

    function wasteRect() {
        const r = wasteEl.getBoundingClientRect();
        return { left: r.left, top: r.top };
    }

    function stockRect() {
        const r = stockEl.getBoundingClientRect();
        return { left: r.left, top: r.top };
    }

    function setDemoStateBasic() {
        // Deterministic, compact state for teaching the loop
        const deck = makeDeck();
        const take = (suit, rank) => {
            const idx = deck.findIndex(c => c.suit === suit && c.rank === rank);
            const c = deck.splice(idx, 1)[0];
            c.faceUp = true;
            return c;
        };

        selection = null;
        hint = null;
        lastMovedCardId = null;
        history = [];
        undoBtn.disabled = true;
        score = 0;
        moves = 0;

        foundations = [[], [], [], []];
        // ♠ A-9, ♥ A-9, ♦ A-10, ♣ A-9
        for (let r = 1; r <= 9; r++) foundations[0].push(take('♠', r));
        for (let r = 1; r <= 9; r++) foundations[1].push(take('♥', r));
        for (let r = 1; r <= 10; r++) foundations[2].push(take('♦', r));
        for (let r = 1; r <= 9; r++) foundations[3].push(take('♣', r));

        tableau = Array.from({ length: 7 }, () => []);
        const tenClub = take('♣', 10);
        tenClub.faceUp = false;
        const jackDiamond = take('♦', 11);
        tableau[2].push(tenClub, jackDiamond);

        const tenSpade = take('♠', 10);
        tenSpade.faceUp = false;
        stock = [tenSpade];
        waste = [];

        setHud();
        setStatus('');
        render();
    }

    function setDemoStateFinish() {
        const deck = makeDeck();
        const take = (suit, rank) => {
            const idx = deck.findIndex(c => c.suit === suit && c.rank === rank);
            const c = deck.splice(idx, 1)[0];
            c.faceUp = true;
            return c;
        };

        selection = null;
        hint = null;
        lastMovedCardId = null;
        history = [];
        undoBtn.disabled = true;
        score = 0;
        moves = 0;

        foundations = [[], [], [], []];
        for (let r = 1; r <= 12; r++) foundations[0].push(take('♠', r));
        for (let r = 1; r <= 12; r++) foundations[1].push(take('♥', r));
        for (let r = 1; r <= 12; r++) foundations[2].push(take('♦', r));
        for (let r = 1; r <= 12; r++) foundations[3].push(take('♣', r));

        tableau = Array.from({ length: 7 }, () => []);
        tableau[0].push(take('♠', 13));
        tableau[1].push(take('♥', 13));
        tableau[2].push(take('♦', 13));
        tableau[3].push(take('♣', 13));

        stock = [];
        waste = [];

        setHud();
        setStatus('');
        render();
    }

    async function demoDrawOnce() {
        // animate a face-down card from stock to waste, then actually draw
        const dummy = { id: -999, suit: '♠', rank: 13, faceUp: false };
        await animMoveElements([dummy], stockRect(), wasteRect(), 22, 320);
        drawFromStock();
    }

    async function demoMoveWasteToFoundation(fIndex) {
        const c = top(waste);
        if (!c) return;
        const fromEl = getCardElById(c.id);
        const fromRect = fromEl ? fromEl.getBoundingClientRect() : wasteRect();
        await animMoveElements([c], fromRect, foundationRect(fIndex), 22, 320);
        selection = { from: 'waste' };
        moveSelectionToFoundation(fIndex);
    }

    async function demoMoveTableauTopToFoundation(col, fIndex) {
        const c = top(tableau[col]);
        if (!c || !c.faceUp) return;
        const fromEl = getCardElById(c.id);
        const fromRect = fromEl ? fromEl.getBoundingClientRect() : tableauDropRect(col);
        await animMoveElements([c], fromRect, foundationRect(fIndex), 22, 320);
        selection = { from: 'tableau', col, index: tableau[col].length - 1 };
        moveSelectionToFoundation(fIndex);
    }

    async function runDemo() {
        if (!demoOverlayEl || !demoBtn) return;
        if (demo.active) return;

        // close tutorial if open
        if (tutorial.open) showTutorial(false, true);

        // snapshot current state and lock scroll for stable overlays/animations
        demoSaved = captureDemoSnapshot();
        demoSavedBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        demo.active = true;
        demo.paused = false;
        demo.token += 1;
        const myToken = demo.token;
        setDemoUi(true);
        setDemoPaused(false);

        // disable other controls while demo runs
        enforceDemoControls();

        try {
            // Part 1: teach core loop
            setDemoStateBasic();
            enforceDemoControls();
            setDemoCaption('solDemoIntro', 'This demo shows a few key moves, then fast-forwards to a finish.');
            await demoSleep(1200);
            if (demo.token !== myToken) return;

            setDemoCaption('solDemoStock', 'Step 1: Draw from Stock.');
            demoHighlight('#sol-stock');
            await demoSleep(700);
            await demoDrawOnce();
            enforceDemoControls();
            await demoSleep(600);
            if (demo.token !== myToken) return;

            setDemoCaption('solDemoWaste', 'Step 2: Move the drawn card (Waste) to a valid target.');
            demoHighlight('#sol-waste');
            await demoSleep(500);
            clearDemoHighlight();
            await demoMoveWasteToFoundation(0);
            enforceDemoControls();
            await demoSleep(600);
            if (demo.token !== myToken) return;

            setDemoCaption('solDemoReveal', 'Step 3: Move a top card to reveal a hidden card.');
            demoHighlight('.sol-col[data-col="2"]');
            await demoSleep(500);
            clearDemoHighlight();
            await demoMoveTableauTopToFoundation(2, 2);
            enforceDemoControls();
            await demoSleep(650);
            // move the revealed 10♣ to foundation ♣
            await demoMoveTableauTopToFoundation(2, 3);
            enforceDemoControls();
            await demoSleep(650);
            if (demo.token !== myToken) return;

            setDemoCaption('solDemoHintAuto', 'Tip: Hint highlights a suggested move. Auto safely moves eligible cards to Foundations.');
            demoHighlight('#sol-hint');
            await demoSleep(700);
            const h = computeHint();
            hint = h && h.target ? { sourceId: h.sourceId, target: h.target } : null;
            setStatus(h ? h.message : '');
            render();
            enforceDemoControls();
            await demoSleep(900);
            clearDemoHighlight();
            demoHighlight('#sol-auto');
            await demoSleep(500);
            autoMoveToFoundations();
            enforceDemoControls();
            await demoSleep(900);
            clearDemoHighlight();

            // Part 2: fast-forward to a finish
            setDemoCaption('solDemoFastForward', 'Fast-forward: let\'s jump to the final moves.');
            await demoSleep(1200);
            if (demo.token !== myToken) return;

            setDemoStateFinish();
            enforceDemoControls();
            setDemoCaption('solDemoFinish', 'Finish: move the last Kings to Foundations to win.');
            await demoSleep(700);

            await demoMoveTableauTopToFoundation(0, 0);
            enforceDemoControls();
            await demoSleep(450);
            await demoMoveTableauTopToFoundation(1, 1);
            enforceDemoControls();
            await demoSleep(450);
            await demoMoveTableauTopToFoundation(2, 2);
            enforceDemoControls();
            await demoSleep(450);
            await demoMoveTableauTopToFoundation(3, 3);
            enforceDemoControls();
            await demoSleep(700);

            setDemoCaption('solDemoDone', 'Demo complete. Try it yourself!');
            await demoSleep(900);
        } finally {
            if (demo.token === myToken) stopDemo();
        }

    }
    function clearTutorialHighlight() {
        document.querySelectorAll('.sol-tut-highlight').forEach(el => el.classList.remove('sol-tut-highlight'));
    }

    function showTutorial(open, force) {
        if (!tutorialEl || !tutorialPopoverEl || !tutorialStepEl || !tutorialDontShowEl || !tutorialSkipBtn || !tutorialBackBtn || !tutorialNextBtn) {
            return;
        }
        if (!force && localStorage.getItem(TUTORIAL_SEEN_KEY) === '1') return;

        tutorial.open = open;
        if (!open) {
            if (practice.active) stopPractice();
            tutorialEl.hidden = true;
            tutorialEl.setAttribute('aria-hidden', 'true');
            clearTutorialHighlight();
            if (tutorialRepositionRaf) {
                cancelAnimationFrame(tutorialRepositionRaf);
                tutorialRepositionRaf = null;
            }
            tutorial.mode = null;
            tutorial.step = 0;
            return;
        }

        tutorialEl.hidden = false;
        tutorialEl.setAttribute('aria-hidden', 'false');
        tutorial.mode = force ? null : 'tour';
        tutorial.step = 0;
        tutorialDontShowEl.checked = localStorage.getItem(TUTORIAL_SEEN_KEY) === '1';
        renderTutorialStep();
    }

    function closeTutorial(markSeen) {
        if (markSeen) localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
        if (tutorialDontShowEl && tutorialDontShowEl.checked) localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
        showTutorial(false, true);
    }

    function getTutorialSteps() {
        if (tutorial.mode === 'tour') return tutorial.stepsTour;
        if (tutorial.mode === 'practice') return tutorial.stepsPractice;
        return null;
    }

    function getTutorialStep() {
        const steps = getTutorialSteps();
        if (!steps) return null;
        return steps[tutorial.step] || null;
    }

    function tutorialTargetElement(step) {
        const targets = (step && step.targets) ? step.targets : [];
        for (const sel of targets) {
            const el = sel ? document.querySelector(sel) : null;
            if (el) return el;
        }
        return null;
    }

    function setTutorialMode(mode) {
        tutorial.mode = mode;
        tutorial.step = 0;
        renderTutorialStep();
    }

    function currentPracticeInstruction() {
        const s = tutorial.stepsPractice[tutorial.step];
        return s ? tt(s.key, '') : '';
    }

    function practiceFollowStatus() {
        const lang = getLang();
        const tr = t(lang);
        const text = currentPracticeInstruction();
        setStatus(format(tr.solPracFollow || (lang === 'zh' ? '请按引导操作：{text}' : 'Follow the guide: {text}'), { text }));
    }

    function enforcePracticeControls() {
        if (!practice.active) return;
        newBtn.disabled = true;
        undoBtn.disabled = true;
        autoBtn.disabled = true;
        guideBtn.disabled = true;
        if (demoBtn) demoBtn.disabled = true;
        hintBtn.disabled = practice.expected !== 'hint';
    }

    function setPracticeExpectedFromTutorialStep() {
        if (!practice.active) return;
        const s = tutorial.stepsPractice[tutorial.step];
        practice.expected = s && s.expect ? s.expect : null;
        enforcePracticeControls();
    }

    function setPracticeState() {
        // Deterministic, tiny state for hands-on learning.
        // Step flow: Draw 5♥ -> move onto 6♠ -> flip A♦ -> move A♦ to any Foundation -> press Hint.
        const deck = makeDeck();
        const take = (suit, rank, faceUp) => {
            const idx = deck.findIndex(c => c.suit === suit && c.rank === rank);
            const c = deck.splice(idx, 1)[0];
            c.faceUp = !!faceUp;
            return c;
        };

        selection = null;
        hint = null;
        lastMovedCardId = null;
        suppressClickUntil = 0;
        history = [];
        undoBtn.disabled = true;
        score = 0;
        moves = 0;

        foundations = [[], [], [], []];
        tableau = Array.from({ length: 7 }, () => []);
        tableau[0].push(take('♠', 6, true));
        tableau[1].push(take('♦', 1, false));
        stock = [take('♥', 5, false)];
        waste = [];

        setHud();
        setStatus('');
        render();
    }

    function startPractice() {
        if (practice.active) return;
        if (demo.active) stopDemo();
        practice.saved = captureDemoSnapshot();
        practice.savedBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        practice.active = true;
        practice.expected = null;
        setPracticeState();
        enforcePracticeControls();
    }

    function stopPractice({ restoreState } = {}) {
        const shouldRestore = restoreState !== false;
        practice.active = false;
        practice.expected = null;
        if (practice.savedBodyOverflow != null) {
            document.body.style.overflow = practice.savedBodyOverflow;
            practice.savedBodyOverflow = null;
        }
        if (shouldRestore && practice.saved) {
            restoreDemoSnapshot(practice.saved);
        }
        practice.saved = null;
    }

    function advancePracticeStep() {
        if (tutorial.mode !== 'practice') return;
        const next = Math.min(tutorial.stepsPractice.length - 1, tutorial.step + 1);
        tutorial.step = next;
        // If we reached the done screen, restore the user's game while keeping the dialog open.
        const s = tutorial.stepsPractice[tutorial.step];
        if (s && s.kind === 'done' && practice.active) {
            stopPractice();
        }
        renderTutorialStep();
    }

    function clamp(n, min, max) {
        return Math.max(min, Math.min(max, n));
    }

    function positionTutorialPopover(targetEl) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const margin = 12;

        const pop = tutorialPopoverEl;
        pop.style.left = '0px';
        pop.style.top = '0px';
        pop.style.setProperty('--arrow-left', '50%');

        const popRect = pop.getBoundingClientRect();
        let x = vw / 2 - popRect.width / 2;
        let y = vh / 2 - popRect.height / 2;
        let pos = 'bottom';
        let arrowLeft = popRect.width / 2;

        if (targetEl) {
            const r = targetEl.getBoundingClientRect();
            const preferBottom = r.top < vh * 0.52;
            pos = preferBottom ? 'bottom' : 'top';
            const cx = r.left + r.width / 2;
            x = cx - popRect.width / 2;
            if (pos === 'bottom') y = r.bottom + 12;
            else y = r.top - popRect.height - 12;

            x = clamp(x, margin, vw - popRect.width - margin);
            y = clamp(y, margin, vh - popRect.height - margin);
            arrowLeft = clamp(cx - x, 18, popRect.width - 18);
        }

        pop.dataset.pos = pos;
        pop.style.left = `${x}px`;
        pop.style.top = `${y}px`;
        pop.style.setProperty('--arrow-left', `${arrowLeft}px`);
    }

    function scheduleTutorialReposition() {
        if (!tutorial.open) return;
        if (!tutorialPopoverEl) return;
        if (tutorialRepositionRaf) return;
        tutorialRepositionRaf = requestAnimationFrame(() => {
            tutorialRepositionRaf = null;
            const s = getTutorialStep();
            positionTutorialPopover(tutorialTargetElement(s));
        });
    }

    function renderTutorialStep() {
        if (!tutorial.open) return;
        const lang = getLang();

        // Mode picker (shown when opened via Guide button)
        if (tutorial.mode == null) {
            clearTutorialHighlight();
            tutorialStepEl.innerHTML = `
                <div>${tt('solTutChooseMode', lang === 'zh' ? '选择引导模式：' : 'Choose a guide mode:')}</div>
                <div class="sol-tutorial-mode">
                    <button type="button" class="btn" id="sol-tutorial-mode-tour">${tt('solTutModeTour', lang === 'zh' ? '快速介绍' : 'Quick Tour')}</button>
                    <button type="button" class="btn primary-btn" id="sol-tutorial-mode-practice">${tt('solTutModePractice', lang === 'zh' ? '新手一步一步' : 'Step-by-step Practice')}</button>
                </div>
                <div class="sol-tutorial-sub">${tt('solTutModeNote', lang === 'zh' ? '提示：练习会临时切换到一局“教学牌面”，退出后会回到你原来的牌局。' : 'Note: Practice switches to a teaching layout temporarily and restores your game when you exit.')}</div>
            `;

            tutorialBackBtn.hidden = true;
            tutorialNextBtn.hidden = true;
            tutorialSkipBtn.hidden = false;
            tutorialSkipBtn.dataset.key = 'exit';
            tutorialSkipBtn.textContent = tt('exit', 'Exit');

            const tourBtn = document.getElementById('sol-tutorial-mode-tour');
            const pracBtn = document.getElementById('sol-tutorial-mode-practice');
            if (tourBtn) tourBtn.addEventListener('click', () => setTutorialMode('tour'), { once: true });
            if (pracBtn) pracBtn.addEventListener('click', () => setTutorialMode('practice'), { once: true });

            scheduleTutorialReposition();
            return;
        }

        const steps = getTutorialSteps();
        const s = steps[tutorial.step];

        tutorialStepEl.textContent = tt(s.key, '');

        clearTutorialHighlight();
        const targets = s.targets || [];
        for (const sel of targets) {
            const el = sel ? document.querySelector(sel) : null;
            if (el) el.classList.add('sol-tut-highlight');
        }

        // Buttons per mode
        tutorialSkipBtn.hidden = false;
        tutorialSkipBtn.dataset.key = tutorial.mode === 'practice' ? 'exit' : 'skip';
        tutorialSkipBtn.textContent = tt(tutorialSkipBtn.dataset.key, tutorial.mode === 'practice' ? 'Exit' : 'Skip');

        if (tutorial.mode === 'tour') {
            tutorialBackBtn.hidden = false;
            tutorialNextBtn.hidden = false;
            tutorialBackBtn.disabled = tutorial.step === 0;
            const isLast = tutorial.step === steps.length - 1;
            tutorialNextBtn.textContent = tt(isLast ? 'done' : 'next', isLast ? 'Done' : 'Next');
            tutorialNextBtn.dataset.key = isLast ? 'done' : 'next';
        } else {
            // practice
            const isIntro = s.kind === 'intro';
            const isDone = s.kind === 'done';

            tutorialBackBtn.hidden = true;
            tutorialNextBtn.hidden = !(isIntro || isDone);
            if (isIntro) {
                tutorialNextBtn.dataset.key = 'start';
                tutorialNextBtn.textContent = tt('start', lang === 'zh' ? '开始' : 'Start');
            } else if (isDone) {
                tutorialNextBtn.dataset.key = 'done';
                tutorialNextBtn.textContent = tt('done', 'Done');
            }
        }

        // mark seen after the first time it pops automatically
        if (localStorage.getItem(TUTORIAL_SEEN_KEY) !== '1') {
            localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
        }

        if (tutorial.mode === 'practice' && practice.active) setPracticeExpectedFromTutorialStep();

        // position after layout
        scheduleTutorialReposition();
    }

    function isSuppressedClick() {
        return Date.now() < suppressClickUntil;
    }

    function format(str, vars) {
        return String(str).replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] != null ? String(vars[k]) : `{${k}}`));
    }

    function pushHistory() {
        const snap = {
            stock: stock.map(c => ({ ...c })),
            waste: waste.map(c => ({ ...c })),
            foundations: foundations.map(p => p.map(c => ({ ...c }))),
            tableau: tableau.map(p => p.map(c => ({ ...c }))),
            score,
            moves
        };
        history.push(snap);
        if (history.length > HISTORY_LIMIT) history.shift();
        undoBtn.disabled = history.length === 0;
    }

    function restore(snap) {
        stock = snap.stock.map(c => ({ ...c }));
        waste = snap.waste.map(c => ({ ...c }));
        foundations = snap.foundations.map(p => p.map(c => ({ ...c })));
        tableau = snap.tableau.map(p => p.map(c => ({ ...c })));
        score = snap.score;
        moves = snap.moves;
        selection = null;
        hint = null;
        lastMovedCardId = null;
        undoBtn.disabled = history.length === 0;
        setHud();
        setStatus('');
        render();
    }

    function undo() {
        if (!history.length) return;
        const snap = history.pop();
        restore(snap);
        lastMove = { type: 'undo' };
    }

    function autoMoveToFoundations() {
        const lang = getLang();
        const tr = t(lang);

        let movedAny = false;

        // compute a single snapshot so Undo returns to pre-auto state
        const tryMoveOnce = () => {
            const w = top(waste);
            if (w) {
                for (let i = 0; i < 4; i++) {
                    if (canMoveToFoundation(w, i) && safeToAutoMoveToFoundation(w)) {
                        foundations[i].push(waste.pop());
                        score = Math.max(0, score + 10);
                        moves += 1;
                        lastMovedCardId = w.id;
                        return true;
                    }
                }
            }
            for (let col = 0; col < 7; col++) {
                const c = top(tableau[col]);
                if (!c || !c.faceUp) continue;
                for (let i = 0; i < 4; i++) {
                    if (canMoveToFoundation(c, i) && safeToAutoMoveToFoundation(c)) {
                        foundations[i].push(tableau[col].pop());
                        revealIfNeeded(col);
                        score = Math.max(0, score + 10);
                        moves += 1;
                        lastMovedCardId = c.id;
                        return true;
                    }
                }
            }
            return false;
        };

        // run auto loop
        const before = snapshotState();
        while (tryMoveOnce()) movedAny = true;

        if (!movedAny) {
            setStatus(tr.hintNoMoves || (lang === 'zh' ? '提示：暂无可用操作' : 'Hint: no moves'));
            return;
        }

        history.push(before);
        if (history.length > HISTORY_LIMIT) history.shift();
        undoBtn.disabled = history.length === 0;

        selection = null;
        hint = null;
        setHud();
        setStatus(tr.solitaireAutoMoved || (lang === 'zh' ? '已自动上基础堆' : 'Auto-moved'));
        render();
    }

    function snapshotState() {
        return {
            stock: stock.map(c => ({ ...c })),
            waste: waste.map(c => ({ ...c })),
            foundations: foundations.map(p => p.map(c => ({ ...c }))),
            tableau: tableau.map(p => p.map(c => ({ ...c }))),
            score,
            moves
        };
    }

    function rankLabel(rank) {
        if (rank === 1) return 'A';
        if (rank === 11) return 'J';
        if (rank === 12) return 'Q';
        if (rank === 13) return 'K';
        return String(rank);
    }

    function makeDeck() {
        const deck = [];
        let id = 0;
        for (const suit of SUITS) {
            for (let rank = 1; rank <= 13; rank++) {
                deck.push({ id: id++, suit, rank, faceUp: false });
            }
        }
        return deck;
    }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function top(arr) {
        return arr.length ? arr[arr.length - 1] : null;
    }

    function isValidTableauStack(stack) {
        if (!stack.length) return false;
        for (let i = 0; i < stack.length; i++) {
            if (!stack[i].faceUp) return false;
            if (i === 0) continue;
            const prev = stack[i - 1];
            const cur = stack[i];
            const colorOk = SUIT_COLOR[prev.suit] !== SUIT_COLOR[cur.suit];
            const rankOk = cur.rank === prev.rank - 1;
            if (!colorOk || !rankOk) return false;
        }
        return true;
    }

    function canMoveToFoundation(card, fIndex) {
        const pile = foundations[fIndex];
        const t = top(pile);
        if (!t) return card.rank === 1;
        return t.suit === card.suit && card.rank === t.rank + 1;
    }

    function foundationTopRankBySuit(suit) {
        for (let i = 0; i < 4; i++) {
            const t0 = top(foundations[i]);
            if (t0 && t0.suit === suit) return t0.rank;
        }
        return 0;
    }

    function safeToAutoMoveToFoundation(card) {
        // Conservative “safe auto” rule to avoid moving cards too early.
        // A/2 are always safe. Otherwise, only auto-move if opposite-color foundations are not far behind.
        if (card.rank <= 2) return true;
        const color = SUIT_COLOR[card.suit];
        const blackMin = Math.min(foundationTopRankBySuit('♠'), foundationTopRankBySuit('♣'));
        const redMin = Math.min(foundationTopRankBySuit('♥'), foundationTopRankBySuit('♦'));
        const oppMin = color === 'red' ? blackMin : redMin;
        return card.rank <= oppMin + 1;
    }

    function canMoveToTableau(card, col) {
        const pile = tableau[col];
        const t = top(pile);
        if (!t) return card.rank === 13;
        if (!t.faceUp) return false;
        const colorOk = SUIT_COLOR[t.suit] !== SUIT_COLOR[card.suit];
        const rankOk = card.rank === t.rank - 1;
        return colorOk && rankOk;
    }

    function revealIfNeeded(col) {
        const pile = tableau[col];
        const t = top(pile);
        if (t && !t.faceUp) t.faceUp = true;
    }

    function clearSelection() {
        selection = null;
        hint = null;
        render();
    }

    function selectWaste() {
        if (!waste.length) return;
        selection = { from: 'waste' };
        render();
    }

    function selectTableau(col, index) {
        const pile = tableau[col];
        const card = pile[index];
        if (!card || !card.faceUp) return;
        selection = { from: 'tableau', col, index };
        render();
    }

    function selectedCards() {
        if (!selection) return null;
        if (selection.from === 'waste') {
            const c = top(waste);
            if (!c) return null;
            return [c];
        }
        const pile = tableau[selection.col];
        const stack = pile.slice(selection.index);
        if (!stack.length || !stack[0].faceUp) return null;
        if (!isValidTableauStack(stack)) return null;
        return stack;
    }

    function removeSelectedFromSource() {
        if (!selection) return [];
        if (selection.from === 'waste') {
            const c = waste.pop();
            return c ? [c] : [];
        }
        const pile = tableau[selection.col];
        const moved = pile.splice(selection.index);
        revealIfNeeded(selection.col);
        return moved;
    }

    function popWasteCard() {
        const c = waste.pop();
        return c ? [c] : [];
    }

    function moveSelectionToFoundation(fIndex) {
        if (demo.active) return false;
        const lang = getLang();
        const tr = t(lang);
        if (!selection) return false;
        if (practice.active) {
            const exp = practice.expected;
            if (exp && exp !== 'moveADiamondToFoundation') {
                practiceFollowStatus();
                return false;
            }
            if (exp === 'moveADiamondToFoundation') {
                const stack = selectedCards();
                const card = stack && stack.length === 1 ? stack[0] : null;
                const isTarget =
                    card &&
                    card.rank === 1 &&
                    card.suit === '♦' &&
                    selection.from === 'tableau' &&
                    selection.col === 1 &&
                    selection.index === tableau[selection.col].length - 1;
                if (!isTarget) {
                    practiceFollowStatus();
                    return false;
                }
            }
        }
        if (selection.from === 'tableau') {
            const stack = selectedCards();
            if (!stack || stack.length !== 1) {
                setStatus(tr.solitaireInvalidMove || (lang === 'zh' ? '这步不合法' : 'Invalid move'));
                return false;
            }
            if (selection.index !== tableau[selection.col].length - 1) {
                setStatus(tr.solitaireInvalidMove || (lang === 'zh' ? '这步不合法' : 'Invalid move'));
                return false;
            }
            const card = stack[0];
            if (!canMoveToFoundation(card, fIndex)) {
                setStatus(tr.solitaireInvalidMove || (lang === 'zh' ? '这步不合法' : 'Invalid move'));
                return false;
            }
            pushHistory();
            tableau[selection.col].pop();
            foundations[fIndex].push(card);
            revealIfNeeded(selection.col);
            score = Math.max(0, score + 10);
            moves += 1;
            lastMovedCardId = card.id;
            lastMove = { type: 'tableauToFoundation', cardId: card.id, fromCol: selection.col };
            clearSelection();
            setStatus('');
            setHud();
            if (practice.active && practice.expected === 'moveADiamondToFoundation') advancePracticeStep();
            return true;
        }

        const card = top(waste);
        if (!card) return false;
        if (!canMoveToFoundation(card, fIndex)) {
            setStatus(tr.solitaireInvalidMove || (lang === 'zh' ? '这步不合法' : 'Invalid move'));
            return false;
        }
        pushHistory();
        foundations[fIndex].push(waste.pop());
        score = Math.max(0, score + 10);
        moves += 1;
        lastMovedCardId = card.id;
        lastMove = { type: 'wasteToFoundation', cardId: card.id };
        clearSelection();
        setStatus('');
        setHud();
        if (practice.active && practice.expected === 'moveADiamondToFoundation') advancePracticeStep();
        return true;
    }

    function moveSelectionToTableau(col) {
        if (demo.active) return false;
        const lang = getLang();
        const tr = t(lang);
        const stack = selectedCards();
        if (!stack || !stack.length) return false;
        const card = stack[0];
        if (practice.active) {
            const exp = practice.expected;
            if (exp && exp !== 'moveWasteToCol0') {
                practiceFollowStatus();
                return false;
            }
            if (exp === 'moveWasteToCol0') {
                const w = top(waste);
                const okCard = w && w.rank === 5 && w.suit === '♥';
                if (!okCard || !selection || selection.from !== 'waste' || col !== 0) {
                    practiceFollowStatus();
                    return false;
                }
            }
        }
        if (!canMoveToTableau(card, col)) {
            setStatus(tr.solitaireInvalidMove || (lang === 'zh' ? '这步不合法' : 'Invalid move'));
            return false;
        }

        pushHistory();
        if (selection.from === 'waste') {
            const movedCard = waste.pop();
            tableau[col].push(movedCard);
            score = Math.max(0, score + 5);
            lastMovedCardId = movedCard.id;
            lastMove = { type: 'wasteToTableau', cardId: movedCard.id, toCol: col };
        } else {
            const fromCol = selection.col;
            const moved = tableau[selection.col].splice(selection.index);
            tableau[col].push(...moved);
            const topAfterRemoval = top(tableau[fromCol]);
            const willReveal = !!(topAfterRemoval && !topAfterRemoval.faceUp);
            revealIfNeeded(fromCol);
            const emptied = tableau[fromCol].length === 0;
            score = Math.max(0, score + 3);
            lastMovedCardId = moved[0] ? moved[0].id : null;
            lastMove = {
                type: 'tableauToTableau',
                cardId: moved[0] ? moved[0].id : null,
                fromCol,
                toCol: col,
                revealed: willReveal,
                emptied
            };
        }
        moves += 1;
        clearSelection();
        setStatus('');
        setHud();
        if (practice.active && practice.expected === 'moveWasteToCol0') advancePracticeStep();
        return true;
    }

    function autoToFoundationFromSelection() {
        if (!selection) return false;
        const stack = selectedCards();
        if (!stack || stack.length !== 1) return false;
        const card = stack[0];
        for (let i = 0; i < 4; i++) {
            if (canMoveToFoundation(card, i)) {
                moveSelectionToFoundation(i);
                return true;
            }
        }
        return false;
    }

    function checkWin() {
        return foundations.every(p => p.length === 13);
    }

    function dealNewGame() {
        const lang = getLang();
        const tr = t(lang);

        selection = null;
        hint = null;
        lastMovedCardId = null;
        foundations = [[], [], [], []];
        tableau = Array.from({ length: 7 }, () => []);
        waste = [];
        stock = shuffle(makeDeck());
        score = 0;
        moves = 0;
        history = [];
        undoBtn.disabled = true;

        for (let col = 0; col < 7; col++) {
            for (let i = 0; i <= col; i++) {
                const card = stock.pop();
                if (!card) continue;
                card.faceUp = i === col;
                tableau[col].push(card);
            }
        }

        setStatus(tr.solitaireReady || (lang === 'zh' ? '准备就绪' : 'Ready'));
        setHud();
        render();
    }

    function drawFromStock() {
        if (demo.active) return;
        if (practice.active && practice.expected !== 'draw') {
            practiceFollowStatus();
            return;
        }
        const lang = getLang();
        const tr = t(lang);

        clearSelection();
        if (stock.length) {
            pushHistory();
            const card = stock.pop();
            card.faceUp = true;
            waste.push(card);
            moves += 1;
            setHud();
            setStatus('');
            render();
            lastMove = { type: 'draw', cardId: card.id };
            if (practice.active && practice.expected === 'draw') advancePracticeStep();
            return;
        }
        // recycle waste to stock
        if (!waste.length) return;
        pushHistory();
        while (waste.length) {
            const c = waste.pop();
            c.faceUp = false;
            stock.push(c);
        }
        moves += 1;
        setHud();
        setStatus(tr.solitaireRecycled || (lang === 'zh' ? '已翻回牌堆' : 'Recycled'));
        render();
        lastMove = { type: 'recycle' };
    }

    function renderCard(card, opts) {
        const el = document.createElement('div');
        el.className = 'sol-card';
        el.dataset.cardId = String(card.id);
        if (!card.faceUp) el.classList.add('face-down');

        const color = SUIT_COLOR[card.suit];
        el.classList.add(color === 'red' ? 'sol-red' : 'sol-black');

        if (opts && opts.selected) el.classList.add('selected');
        if (opts && opts.hinted) el.classList.add('hint');
        if (opts && opts.moved) el.classList.add('moved');

        el.innerHTML = `
            <div class="sol-corner">
                <div class="sol-rank">${rankLabel(card.rank)}</div>
                <div class="sol-suit">${card.suit}</div>
            </div>
            <div class="sol-center">${card.suit}</div>
            <div class="sol-corner" style="transform: rotate(180deg);">
                <div class="sol-rank">${rankLabel(card.rank)}</div>
                <div class="sol-suit">${card.suit}</div>
            </div>
        `;
        return el;
    }

    function render() {
        const selectionStack = selectedCards();
        const selectionTargets = selectionStack ? computeValidTargetsForStack(selectionStack) : null;

        // stock
        stockEl.innerHTML = '';
        stockEl.classList.toggle('hint-target', hint && hint.target && hint.target.type === 'stock');
        if (stock.length) {
            const dummy = { id: -1, suit: '♠', rank: 13, faceUp: false };
            const el = renderCard(dummy, {});
            el.style.position = 'absolute';
            stockEl.appendChild(el);
        }

        // waste
        wasteEl.innerHTML = '';
        wasteEl.classList.toggle('hint-target', hint && hint.target && hint.target.type === 'waste');
        const w = top(waste);
        if (w) {
            const selected = selection && selection.from === 'waste';
                const hinted = hint && (hint.sourceId === w.id || hint.targetCardId === w.id);
                const moved = lastMovedCardId === w.id;
                const el = renderCard(w, { selected, hinted, moved });
                el.style.position = 'absolute';
                wasteEl.appendChild(el);
            }

        // foundations
        for (let i = 0; i < 4; i++) {
            const fEl = foundationEls[i];
            fEl.innerHTML = '';
            fEl.dataset.foundationIndex = String(i);
            fEl.classList.toggle('hint-target', hint && hint.target && hint.target.type === 'foundation' && hint.target.index === i);
            fEl.classList.toggle('drop-valid', !!(selectionTargets && selectionTargets.validFoundations.has(i)));
            const c = top(foundations[i]);
            if (c) {
                const el = renderCard(c, {});
                el.style.position = 'absolute';
                fEl.appendChild(el);
            }
        }

        // tableau
        tableauEl.innerHTML = '';
        for (let col = 0; col < 7; col++) {
            const colEl = document.createElement('div');
            colEl.className = 'sol-col';
            colEl.dataset.col = String(col);

            const slot = document.createElement('div');
            slot.className = 'sol-slot';
            slot.dataset.col = String(col);
            slot.classList.toggle('hint-target', hint && hint.target && hint.target.type === 'tableau' && hint.target.index === col);
            slot.classList.toggle('drop-valid', !!(selectionTargets && selectionTargets.validTableau.has(col)));
            colEl.appendChild(slot);

            const pile = tableau[col];
            for (let i = 0; i < pile.length; i++) {
                const card = pile[i];
                const selected =
                    selection &&
                    selection.from === 'tableau' &&
                    selection.col === col &&
                    selection.index === i;
                const hinted = hint && (hint.sourceId === card.id || hint.targetCardId === card.id);
                const moved = lastMovedCardId === card.id;
                const el = renderCard(card, { selected, hinted, moved });
                el.style.top = `${i * 22}px`;
                el.dataset.col = String(col);
                el.dataset.index = String(i);
                colEl.appendChild(el);
            }

            tableauEl.appendChild(colEl);
        }

        if (checkWin()) {
            const lang = getLang();
            const tr = t(lang);
            setStatus(tr.solitaireWin || (lang === 'zh' ? '恭喜通关！' : 'You win!'));
        }

        // ensure move animation doesn't re-trigger on the next render
        lastMovedCardId = null;
    }

    function clearDropTargetHighlight() {
        document.querySelectorAll('.sol-slot.drop-target').forEach(el => el.classList.remove('drop-target'));
        document.querySelectorAll('.sol-card.drop-target').forEach(el => el.classList.remove('drop-target'));
    }

    function clearValidDropHighlights() {
        document.querySelectorAll('.sol-slot.drop-valid').forEach(el => el.classList.remove('drop-valid'));
    }

    function computeValidTargetsForStack(stack) {
        const validTableau = new Set();
        const validFoundations = new Set();
        if (!stack || !stack.length) return { validTableau, validFoundations };

        const card = stack[0];
        for (let col = 0; col < 7; col++) {
            if (canMoveToTableau(card, col)) validTableau.add(col);
        }

        let canFoundation = stack.length === 1;
        if (canFoundation && selection && selection.from === 'tableau') {
            canFoundation = selection.index === tableau[selection.col].length - 1;
        }
        if (canFoundation) {
            for (let i = 0; i < 4; i++) {
                if (canMoveToFoundation(card, i)) validFoundations.add(i);
            }
        }

        return { validTableau, validFoundations };
    }

    function setDragValidTargets(stack) {
        const targets = computeValidTargetsForStack(stack);
        dragState.validTableau = targets.validTableau;
        dragState.validFoundations = targets.validFoundations;
    }

    function applyValidDropHighlights() {
        clearValidDropHighlights();
        if (dragState.validFoundations) {
            dragState.validFoundations.forEach((i) => {
                const el = foundationEls[i];
                if (el) el.classList.add('drop-valid');
            });
        }
        if (dragState.validTableau) {
            dragState.validTableau.forEach((col) => {
                const slot = tableauEl.querySelector(`.sol-slot[data-col="${col}"]`);
                if (slot) slot.classList.add('drop-valid');
            });
        }
    }

    function setDropTarget(target) {
        clearDropTargetHighlight();
        dragState.target = target;
        if (!target) return;
        if (target.type === 'foundation') {
            const el = foundationEls[target.index];
            if (el) el.classList.add('drop-target');
            return;
        }
        if (target.type === 'tableau') {
            const slot = tableauEl.querySelector(`.sol-slot[data-col="${target.index}"]`);
            if (slot) slot.classList.add('drop-target');
        }
    }

    function dragCleanup() {
        if (dragState.layer) {
            dragState.layer.remove();
        }
        dragState.pending = null;
        dragState.active = false;
        dragState.pointerId = null;
        dragState.offsetX = 0;
        dragState.offsetY = 0;
        dragState.target = null;
        dragState.validTableau = null;
        dragState.validFoundations = null;
        dragState.layer = null;
        dragState.cards = [];
        clearDropTargetHighlight();
        clearValidDropHighlights();
    }

    function startDrag(pending) {
        const lang = getLang();
        const tr = t(lang);
        const source = pending.source;

        hint = null;
        setStatus('');
        render();

        let stack = null;
        if (source === 'waste') {
            const w = top(waste);
            if (!w) return false;
            selection = { from: 'waste' };
            stack = [w];
        } else {
            const pile = tableau[pending.col];
            const card = pile[pending.index];
            if (!card || !card.faceUp) return false;
            selection = { from: 'tableau', col: pending.col, index: pending.index };
            stack = selectedCards();
            if (!stack) {
                selection = null;
                setStatus(tr.solitaireInvalidMove || (lang === 'zh' ? '这步不合法' : 'Invalid move'));
                return false;
            }
        }

        setDragValidTargets(stack);

        const layer = document.createElement('div');
        layer.className = 'sol-drag-layer';
        document.body.appendChild(layer);

        const originRect = pending.originRect;
        dragState.offsetX = pending.startX - originRect.left;
        dragState.offsetY = pending.startY - originRect.top;
        dragState.layer = layer;
        dragState.active = true;
        dragState.pointerId = pending.pointerId;

        // create visual clones
        dragState.cards = [];
        for (let i = 0; i < stack.length; i++) {
            const c = stack[i];
            const el = renderCard(c, { selected: i === 0 });
            el.classList.add('dragging');
            el.style.position = 'fixed';
            el.style.left = `${originRect.left}px`;
            el.style.top = `${originRect.top + i * 22}px`;
            el.style.transform = 'none';
            el.style.zIndex = String(10000 + i);
            layer.appendChild(el);
            dragState.cards.push({ card: c, el, dy: i * 22 });
        }

        applyValidDropHighlights();
        moveDrag(pending.startX, pending.startY);
        return true;
    }

    function moveDrag(clientX, clientY) {
        if (!dragState.active || !dragState.layer) return;
        const x = clientX - dragState.offsetX;
        const y = clientY - dragState.offsetY;
        for (const item of dragState.cards) {
            item.el.style.left = `${x}px`;
            item.el.style.top = `${y + item.dy}px`;
        }

        // detect drop target under pointer
        const el = document.elementFromPoint(clientX, clientY);
        if (!el) {
            setDropTarget(null);
            return;
        }
        const f = el.closest('[data-foundation-index]');
        if (f) {
            const idx = Number(f.dataset.foundationIndex);
            if (Number.isFinite(idx) && dragState.validFoundations && dragState.validFoundations.has(idx)) {
                setDropTarget({ type: 'foundation', index: idx });
            } else {
                setDropTarget(null);
            }
            return;
        }
        const colEl = el.closest('.sol-col');
        if (colEl && colEl.dataset.col != null) {
            const col = Number(colEl.dataset.col);
            if (Number.isFinite(col) && dragState.validTableau && dragState.validTableau.has(col)) {
                setDropTarget({ type: 'tableau', index: col });
            } else {
                setDropTarget(null);
            }
            return;
        }
        setDropTarget(null);
    }

    function finishDrag() {
        const target = dragState.target;
        const wasActive = dragState.active;
        dragCleanup();

        if (!wasActive) return;

        let ok = false;
        if (target) {
            if (target.type === 'foundation') ok = moveSelectionToFoundation(target.index);
            else if (target.type === 'tableau') ok = moveSelectionToTableau(target.index);
        }

        // If the move failed, keep selection so the player can try another target (like click-to-move).
        if (!ok) render();

        suppressClickUntil = Date.now() + 350;
    }

    function onWasteClick(e) {
        if (isSuppressedClick()) return;
        const w = top(waste);
        if (!w) return;
        const isSelected = selection && selection.from === 'waste';
        if (isSelected) clearSelection();
        else selectWaste();
    }

    function onFoundationClick(index) {
        if (!selection) return;
        moveSelectionToFoundation(index);
    }

    function onTableauClick(e) {
        if (isSuppressedClick()) return;
        const cardEl = e.target.closest('.sol-card');
        const colEl = e.target.closest('.sol-col');
        if (!colEl) return;
        const col = Number(colEl.dataset.col);
        if (!Number.isFinite(col)) return;

        if (cardEl && cardEl.dataset.index != null) {
            const idx = Number(cardEl.dataset.index);
            const card = tableau[col][idx];
            if (!card) return;

            if (!card.faceUp) {
                // flip only if it's the top
                if (idx === tableau[col].length - 1) {
                    if (demo.active) return;
                    if (practice.active) {
                        if (practice.expected !== 'flipCol1Top' || col !== 1) {
                            practiceFollowStatus();
                            return;
                        }
                    }
                    pushHistory();
                    card.faceUp = true;
                    score = Math.max(0, score + 5);
                    moves += 1;
                    lastMovedCardId = card.id;
                    lastMove = { type: 'flip', cardId: card.id, col };
                    clearSelection();
                    setStatus('');
                    setHud();
                    if (practice.active && practice.expected === 'flipCol1Top') advancePracticeStep();
                    return;
                }
                return;
            }

            // same card toggles selection
            if (selection && selection.from === 'tableau' && selection.col === col && selection.index === idx) {
                clearSelection();
                return;
            }

            // if we already selected something, try move to this column
            if (selection) {
                moveSelectionToTableau(col);
                return;
            }

            selectTableau(col, idx);
            return;
        }

        // click empty column area: attempt move selection here
        if (selection) moveSelectionToTableau(col);
    }

    function onDoubleClick(e) {
        const cardEl = e.target.closest('.sol-card');
        if (!cardEl) return;
        const wasteParent = cardEl.parentElement === wasteEl;
        if (wasteParent) {
            selectWaste();
            autoToFoundationFromSelection();
            return;
        }
        const colEl = e.target.closest('.sol-col');
        if (!colEl) return;
        const col = Number(colEl.dataset.col);
        const idx = Number(cardEl.dataset.index);
        selectTableau(col, idx);
        autoToFoundationFromSelection();
    }

    stockEl.addEventListener('click', drawFromStock);
    wasteEl.addEventListener('click', onWasteClick);
    tableauEl.addEventListener('click', onTableauClick);
    tableauEl.addEventListener('dblclick', onDoubleClick);
    for (let i = 0; i < 4; i++) {
        foundationEls[i].addEventListener('click', () => onFoundationClick(i));
    }
    newBtn.addEventListener('click', dealNewGame);
    undoBtn.addEventListener('click', undo);
    autoBtn.addEventListener('click', autoMoveToFoundations);
    guideBtn.addEventListener('click', () => showTutorial(true, true));

    function computeHint() {
        const lang = getLang();
        const tr = t(lang);
        hint = null;

        const candidates = [];
        const add = (weight, sourceId, target, message, targetCardId) => candidates.push({ weight, sourceId, target, message, targetCardId: targetCardId || null });

        const revealBonusIfMoveFrom = (fromCol, fromIndex) => {
            if (fromCol == null || fromIndex == null) return 0;
            const pile = tableau[fromCol];
            if (!pile.length) return 0;
            let firstFaceUp = -1;
            for (let i = 0; i < pile.length; i++) {
                if (pile[i].faceUp) { firstFaceUp = i; break; }
            }
            if (firstFaceUp !== -1 && fromIndex === firstFaceUp && firstFaceUp > 0) return 12;
            return 0;
        };

        const w = top(waste);
        if (w) {
            for (let i = 0; i < 4; i++) {
                if (canMoveToFoundation(w, i) && safeToAutoMoveToFoundation(w)) {
                    const msg = format(
                        tr.hintMoveToFoundationDetail || (lang === 'zh' ? '提示：将 {card} 移到基础堆' : 'Hint: move {card} to Foundations'),
                        { card: cardLabel(w) }
                    );
                    add(100, w.id, { type: 'foundation', index: i }, msg);
                }
            }
        }

        for (let col = 0; col < 7; col++) {
            const c = top(tableau[col]);
            if (c && c.faceUp) {
                for (let i = 0; i < 4; i++) {
                    if (canMoveToFoundation(c, i) && safeToAutoMoveToFoundation(c)) {
                        const bonus = revealBonusIfMoveFrom(col, tableau[col].length - 1);
                        const msg = format(
                            tr.hintMoveToFoundationDetail || (lang === 'zh' ? '提示：将 {card} 移到基础堆' : 'Hint: move {card} to Foundations'),
                            { card: cardLabel(c) }
                        );
                        add(95 + bonus, c.id, { type: 'foundation', index: i }, msg);
                    }
                }
            }
        }

        // Flip a newly-uncovered face-down top card (meaningful progress).
        for (let col = 0; col < 7; col++) {
            const c = top(tableau[col]);
            if (c && !c.faceUp) {
                const msg = format(
                    tr.hintFlipTopCard || (lang === 'zh' ? '提示：翻开第 {col} 列最上面的暗牌' : 'Hint: flip the top face-down card in column {col}'),
                    { col: col + 1 }
                );
                add(85, c.id, { type: 'tableau', index: col }, msg, c.id);
            }
        }

        if (w) {
            for (let col = 0; col < 7; col++) {
                if (canMoveToTableau(w, col)) {
                    const pileTop = top(tableau[col]);
                    const targetCardId = pileTop && pileTop.faceUp ? pileTop.id : null;
                    const dest = tableauTargetLabel(col);
                    const colNum = col + 1;
                    const msg = format(
                        pileTop
                            ? (tr.hintMoveToTableauDetailCol ||
                                tr.hintMoveToTableauDetail ||
                                (lang === 'zh' ? '提示：将 {card} 移到 {dest} 上（第 {col} 列）' : 'Hint: move {card} onto {dest} (Column {col})'))
                            : (tr.hintMoveToTableauEmptyDetailCol ||
                                tr.hintMoveToTableauEmptyDetail ||
                                (lang === 'zh' ? '提示：将 {card} 移到空列（第 {col} 列）' : 'Hint: move {card} to an empty column (Column {col})')),
                        { card: cardLabel(w), dest, col: colNum }
                    );
                    add(70, w.id, { type: 'tableau', index: col }, msg, targetCardId);
                }
            }
        }

        for (let from = 0; from < 7; from++) {
            const pile = tableau[from];
            for (let idx = pile.length - 1; idx >= 0; idx--) {
                const card = pile[idx];
                if (!card.faceUp) break;
                const stack = pile.slice(idx);
                if (!isValidTableauStack(stack)) continue;
                for (let to = 0; to < 7; to++) {
                    if (to === from) continue;
                    if (canMoveToTableau(stack[0], to)) {
                        const bonus = revealBonusIfMoveFrom(from, idx);
                        const wouldEmpty = idx === 0 && pile.length === stack.length;
                        const isReverse =
                            lastMove &&
                            lastMove.type === 'tableauToTableau' &&
                            lastMove.cardId != null &&
                            lastMove.cardId === stack[0].id &&
                            lastMove.fromCol === to &&
                            lastMove.toCol === from;
                        // Avoid hinting zero-progress oscillations (move-back-and-forth) unless it reveals a face-down card
                        // or creates an empty column (both are meaningful progress).
                        if (isReverse && bonus === 0 && !wouldEmpty) continue;

                        const toTop = top(tableau[to]);
                        const targetCardId = toTop && toTop.faceUp ? toTop.id : null;
                        const dest = tableauTargetLabel(to);
                        const colNum = to + 1;
                        const msg = format(
                            toTop
                                ? (tr.hintMoveToTableauDetailCol ||
                                    tr.hintMoveToTableauDetail ||
                                    (lang === 'zh' ? '提示：将 {card} 移到 {dest} 上（第 {col} 列）' : 'Hint: move {card} onto {dest} (Column {col})'))
                                : (tr.hintMoveToTableauEmptyDetailCol ||
                                    tr.hintMoveToTableauEmptyDetail ||
                                    (lang === 'zh' ? '提示：将 {card} 移到空列（第 {col} 列）' : 'Hint: move {card} to an empty column (Column {col})')),
                            { card: cardLabel(stack[0]), dest, col: colNum }
                        );
                        add(60 + bonus, stack[0].id, { type: 'tableau', index: to }, msg, targetCardId);
                    }
                }
            }
        }

        if (stock.length) {
            add(30, null, { type: 'stock' }, tr.hintDraw || (lang === 'zh' ? '提示：从牌堆抽一张' : 'Hint: draw a card'));
        } else if (waste.length) {
            add(25, null, { type: 'stock' }, tr.hintRecycle || (lang === 'zh' ? '提示：把废牌翻回牌堆' : 'Hint: recycle waste'));
        }

        if (!candidates.length) {
            return { sourceId: null, target: null, message: tr.hintNoMoves || (lang === 'zh' ? '提示：暂无可用操作' : 'Hint: no moves') };
        }

        candidates.sort((a, b) => b.weight - a.weight);
        const best = candidates[0];
        return { sourceId: best.sourceId, target: best.target, message: best.message, targetCardId: best.targetCardId || null };
    }

    hintBtn.addEventListener('click', () => {
        if (demo.active) return;
        if (practice.active && practice.expected !== 'hint') {
            practiceFollowStatus();
            return;
        }
        const h = computeHint();
        hint = h && h.target ? { sourceId: h.sourceId, target: h.target, targetCardId: h.targetCardId || null } : null;
        setStatus(h ? h.message : '');
        render();

        // If the tableau is horizontally scrollable, bring the hinted target into view.
        if (hint && hint.target) {
            requestAnimationFrame(() => {
                if (!hint || !hint.target) return;
                let el = null;
                if (hint.targetCardId != null) {
                    el = document.querySelector(`.sol-card[data-card-id="${hint.targetCardId}"]`);
                }
                if (!el && hint.target.type === 'tableau') {
                    el = document.querySelector(`.sol-col[data-col="${hint.target.index}"]`);
                } else if (!el && hint.target.type === 'foundation') {
                    el = foundationEls[hint.target.index] || null;
                } else if (!el && hint.target.type === 'stock') {
                    el = stockEl;
                } else if (!el && hint.target.type === 'waste') {
                    el = wasteEl;
                }
                if (el && typeof el.scrollIntoView === 'function') {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
            });
        }
        if (practice.active && practice.expected === 'hint') advancePracticeStep();
    });

    document.addEventListener('languageChanged', () => {
        const lang = getLang();
        const tr = t(lang);
        if (!checkWin()) setStatus(tr.solitaireReady || (lang === 'zh' ? '准备就绪' : 'Ready'));
        setHud();
        render();

        if (tutorial.open) renderTutorialStep();
        if (demo.active && demo.caption && demoCaptionEl) {
            demoCaptionEl.textContent = tt(demo.caption.key, demo.caption.fallback || '');
        }
    });

    if (tutorialEl && tutorialSkipBtn && tutorialBackBtn && tutorialNextBtn) {
        tutorialSkipBtn.addEventListener('click', () => closeTutorial(true));
        tutorialBackBtn.addEventListener('click', () => {
            if (tutorial.mode !== 'tour') return;
            const steps = getTutorialSteps() || [];
            tutorial.step = Math.max(0, tutorial.step - 1);
            tutorial.step = Math.min(Math.max(0, steps.length - 1), tutorial.step);
            renderTutorialStep();
        });
        tutorialNextBtn.addEventListener('click', () => {
            if (tutorial.mode === 'practice') {
                const s = getTutorialStep();
                if (s && s.kind === 'intro') {
                    startPractice();
                    tutorial.step = Math.min(tutorial.stepsPractice.length - 1, tutorial.step + 1);
                    renderTutorialStep();
                    setPracticeExpectedFromTutorialStep();
                    return;
                }
                closeTutorial(true);
                return;
            }
            if (tutorial.mode !== 'tour') return;
            const steps = getTutorialSteps() || [];
            const isLast = tutorial.step === steps.length - 1;
            if (isLast) return closeTutorial(true);
            tutorial.step = Math.min(steps.length - 1, tutorial.step + 1);
            renderTutorialStep();
        });
        tutorialEl.addEventListener('click', (e) => {
            if (e.target && e.target.classList.contains('sol-tutorial-backdrop')) closeTutorial(true);
        });
        window.addEventListener('resize', scheduleTutorialReposition);
        // Capture scroll events from window and any scrollable containers
        document.addEventListener('scroll', scheduleTutorialReposition, true);
    }

    document.addEventListener('keydown', (e) => {
        const key = e.key;
        if (demo.active) {
            if (key === 'Escape') stopDemo();
            return;
        }
        if (practice.active) {
            if (key === 'Escape') closeTutorial(true);
            return;
        }
        const tag = e.target && e.target.tagName ? String(e.target.tagName).toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
        if (key === 'Escape') {
            clearSelection();
            return;
        }
        if (key === 'd' || key === 'D') {
            drawFromStock();
            return;
        }
        if (key === 'u' || key === 'U') {
            undo();
            return;
        }
        if (key === 'h' || key === 'H') {
            hintBtn.click();
            return;
        }
        if (key === 'a' || key === 'A') {
            autoMoveToFoundations();
        }
    });

    function onPointerDownOnCard(e, source) {
        if (demo.active) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (dragState.pending || dragState.active) return;

        const cardEl = e.target.closest('.sol-card');
        if (!cardEl) return;

        if (source === 'waste') {
            // only top waste card
            if (cardEl.parentElement !== wasteEl) return;
            if (!waste.length) return;
        } else {
            const col = Number(cardEl.dataset.col);
            const idx = Number(cardEl.dataset.index);
            if (!Number.isFinite(col) || !Number.isFinite(idx)) return;
            const card = tableau[col] && tableau[col][idx];
            if (!card || !card.faceUp) return;
        }

        const rect = cardEl.getBoundingClientRect();
        dragState.pending = {
            source,
            col: source === 'tableau' ? Number(cardEl.dataset.col) : null,
            index: source === 'tableau' ? Number(cardEl.dataset.index) : null,
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            originRect: rect
        };

        document.addEventListener('pointermove', onPointerMove, { passive: false });
        document.addEventListener('pointerup', onPointerUp, { passive: false });
        document.addEventListener('pointercancel', onPointerUp, { passive: false });
    }

    function onPointerMove(e) {
        if (!dragState.pending && !dragState.active) return;
        if (dragState.pending && e.pointerId !== dragState.pending.pointerId) return;
        if (dragState.active && e.pointerId !== dragState.pointerId) return;

        if (dragState.pending && !dragState.active) {
            const dx = e.clientX - dragState.pending.startX;
            const dy = e.clientY - dragState.pending.startY;
            const dist = Math.hypot(dx, dy);
            if (dist < 8) return;
            e.preventDefault();
            const ok = startDrag(dragState.pending);
            dragState.pending = null;
            if (!ok) {
                document.removeEventListener('pointermove', onPointerMove);
                document.removeEventListener('pointerup', onPointerUp);
                document.removeEventListener('pointercancel', onPointerUp);
            }
            return;
        }

        if (dragState.active) {
            e.preventDefault();
            moveDrag(e.clientX, e.clientY);
        }
    }

    function onPointerUp(e) {
        if (dragState.pending && e.pointerId === dragState.pending.pointerId) {
            dragState.pending = null;
        }
        if (dragState.active && e.pointerId === dragState.pointerId) {
            e.preventDefault();
            finishDrag();
        }
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerUp);
    }

    wasteEl.addEventListener('pointerdown', (e) => onPointerDownOnCard(e, 'waste'));
    tableauEl.addEventListener('pointerdown', (e) => onPointerDownOnCard(e, 'tableau'));

    if (demoBtn && demoOverlayEl && demoExitBtn && demoPauseBtn && demoPlayBtn) {
        demoBtn.addEventListener('click', () => runDemo());
        demoExitBtn.addEventListener('click', () => {
            stopDemo();
        });
        demoPauseBtn.addEventListener('click', () => setDemoPaused(true));
        demoPlayBtn.addEventListener('click', () => setDemoPaused(false));
        demoOverlayEl.addEventListener('click', (e) => {
            if (e.target && e.target.classList.contains('sol-demo-backdrop')) {
                // allow click-through; don't exit automatically
                setDemoPaused(!demo.paused);
            }
        });
    }

    dealNewGame();
    // auto-show tutorial on first visit
    setTimeout(() => showTutorial(true, false), 300);
})();
