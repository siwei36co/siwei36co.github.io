// 立即执行的函数表达式，确保脚本在页面加载后立即执行
(function() {
    // 设置一个全局变量，用于跟踪游戏是否已经初始化
    window.memoryGameInitialized = false;
    
    // 游戏初始化函数
    function initMemoryGame() {
        if (window.memoryGameInitialized) {
            console.log('Memory game already initialized, skipping');
            return;
        }
        
        console.log('Initializing memory game (global init)');
        
        // 确保游戏板存在
        const gameBoard = document.querySelector('.game-board');
        if (!gameBoard) {
            console.error('Game board not found, cannot initialize game');
            return;
        }
        
        // 确保游戏板可见
        gameBoard.style.display = 'grid';
        
        // 初始化游戏
        window.memoryGame = new MemoryGame();
        window.memoryGameInitialized = true;
        
        console.log('Memory game initialized globally');
    }
    
    // 在文档加载完成时初始化游戏
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Memory game script loaded, initializing game...');
        
        // 设置一个延迟，确保DOM完全加载
        setTimeout(initMemoryGame, 500);
        
        // 为"立即开始"按钮添加点击事件，重新初始化游戏
        const playNowBtn = document.querySelector('.game-card[data-category="puzzle"] .play-btn');
        if (playNowBtn) {
            playNowBtn.addEventListener('click', function() {
                console.log('Play Now button clicked');
                
                // 延迟初始化游戏，确保页面已滚动到游戏区域
                setTimeout(function() {
                    if (window.memoryGame) {
                        window.memoryGame.initGame();
                    } else {
                        initMemoryGame();
                    }
                }, 300);
            });
        }
    });
    
    // 确保即使在窗口加载后也能初始化游戏
    window.addEventListener('load', function() {
        console.log('Window fully loaded');
        
        // 如果DOMContentLoaded没有成功初始化游戏，再次尝试
        if (!window.memoryGameInitialized) {
            setTimeout(initMemoryGame, 500);
        }
    });
    
    // Memory Game logic
    class MemoryGame {
        constructor(totalCards = 16) {
            console.log('Constructing memory game with', totalCards, 'cards');
            
            this.cardsContainer = document.querySelector('.game-board');
            this.movesElement = document.querySelector('.moves');
            this.timerElement = document.querySelector('.timer');
            this.resetButton = document.querySelector('#reset-game');
            
            console.log('DOM elements found:', {
                cardsContainer: !!this.cardsContainer,
                movesElement: !!this.movesElement,
                timerElement: !!this.timerElement,
                resetButton: !!this.resetButton
            });
            
            // 如果找不到必要的DOM元素，添加后备元素
            if (!this.cardsContainer) {
                console.warn('Game board not found, attempting to create one');
                const gamePreview = document.querySelector('.game-preview');
                if (gamePreview) {
                    const existingGame = document.querySelector('#memory-game');
                    if (existingGame) {
                        this.cardsContainer = document.createElement('div');
                        this.cardsContainer.className = 'game-board';
                        existingGame.appendChild(this.cardsContainer);
                        console.log('Created game board element');
                    }
                }
            }
            
            this.totalCards = totalCards;
            this.cards = [];
            this.flippedCards = [];
            this.matchedPairs = 0;
            this.moves = 0;
            this.timer = 0;
            this.timerInterval = null;
            this.gameStarted = false;
            this.gameActive = true;
            
            // Card symbols using Font Awesome icons
            this.cardSymbols = [
                'fa-heart', 'fa-star', 'fa-bolt', 'fa-globe',
                'fa-music', 'fa-moon', 'fa-sun', 'fa-car',
                'fa-cloud', 'fa-fire', 'fa-tree', 'fa-bell',
                'fa-gift', 'fa-apple-whole', 'fa-camera', 'fa-house'
            ];
            
            // 初始化游戏
            this.initGame();
            this.setupEventListeners();
            
            // 让第一个游戏卡片的"立即开始"按钮正确跳转到这个游戏
            this.setupPlayNowLink();
        }
        
        // 设置"立即开始"按钮正确跳转到精选游戏区域
        setupPlayNowLink() {
            const playNowBtn = document.querySelector('.game-card[data-category="puzzle"] .play-btn');
            console.log('Found play now button:', !!playNowBtn);
            
            if (playNowBtn) {
                playNowBtn.addEventListener('click', (e) => {
                    console.log('Play Now button clicked, initializing game...');
                    // 确保游戏初始化
                    setTimeout(() => {
                        this.initGame();
                    }, 100);
                });
            }
        }
        
        initGame() {
            console.log('Initializing memory game');
            this.cardsContainer.innerHTML = '';
            this.cards = [];
            this.flippedCards = [];
            this.matchedPairs = 0;
            this.moves = 0;
            this.timer = 0;
            this.gameStarted = false;
            this.gameActive = true;
            
            this.updateMovesText();
            this.updateTimerText();
            this.clearTimer();
            
            this.createCards();
            this.renderCards();
            
            // 初始时显示欢迎动画
            this.showWelcomeAnimation();
            
            console.log('Memory game initialized with', this.cards.length, 'cards');
        }
        
        // 欢迎动画 - 快速展示所有卡片然后翻回
        showWelcomeAnimation() {
            setTimeout(() => {
                // 首先翻转所有卡片
                const cardElements = document.querySelectorAll('.memory-card');
                console.log('Welcome animation: found', cardElements.length, 'cards to animate');
                
                cardElements.forEach(card => {
                    card.classList.add('flip');
                });
                
                // 然后在短暂延迟后翻回
                setTimeout(() => {
                    cardElements.forEach(card => {
                        card.classList.remove('flip');
                    });
                }, 1000);
            }, 500);
        }
        
        setupEventListeners() {
            this.resetButton.addEventListener('click', () => this.initGame());
            
            // 监听语言变化事件
            document.addEventListener('languageChanged', (e) => {
                console.log('Language change detected in memory-game.js:', e.detail.language);
                this.updateGameText(e.detail.language);
            });

            // 初始化时也更新一次文本
            const currentLang = localStorage.getItem('language') || 
                              (navigator.language || navigator.userLanguage).split('-')[0];
            this.updateGameText(['zh', 'en'].includes(currentLang) ? currentLang : 'en');
        }
        
        // 更新游戏内的所有文本元素以响应语言变化
        updateGameText(lang) {
            console.log('Updating game text to language:', lang);
            
            // 更新移动次数文本
            this.updateMovesText();
            
            // 更新计时器文本
            this.updateTimerText();
            
            // 更新重置按钮文本
            if (this.resetButton) {
                try {
                    const translationSource = this.getTranslationSource(lang);
                    
                    if (translationSource && translationSource[lang]) {
                        this.resetButton.textContent = translationSource[lang].resetGame;
                        console.log('Reset button text updated to:', translationSource[lang].resetGame);
                    }
                } catch (e) {
                    console.error('Error updating reset button text:', e);
                }
            }
        }
        
        // 获取当前语言的翻译源
        getTranslationSource(lang) {
            // 首先尝试使用主翻译
            if (typeof translations !== 'undefined' && translations && translations[lang]) {
                return translations;
            }
            // 然后尝试使用备用翻译
            if (typeof fallbackTranslations !== 'undefined' && fallbackTranslations && fallbackTranslations[lang]) {
                return fallbackTranslations;
            }
            
            return null;
        }
        
        createCards() {
            // Select half as many symbols as cards needed (each symbol appears twice)
            const selectedSymbols = this.cardSymbols.slice(0, this.totalCards / 2);
            
            // Create pairs of cards with the same symbol
            const cardPairs = [...selectedSymbols, ...selectedSymbols];
            
            // Shuffle the cards
            const shuffledCards = this.shuffleArray(cardPairs);
            
            // Create card objects
            this.cards = shuffledCards.map((symbol, index) => ({
                id: index,
                symbol: symbol,
                isFlipped: false,
                isMatched: false
            }));
        }
        
        // Fisher-Yates shuffle algorithm
        shuffleArray(array) {
            const shuffled = [...array];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        }
        
        renderCards() {
            console.log('Rendering cards to the game board');
            if (!this.cardsContainer) {
                console.error('Cards container not found!');
                return;
            }
            
            this.cardsContainer.innerHTML = '';
            
            // 先创建一个容器元素
            const fragment = document.createDocumentFragment();
            
            this.cards.forEach(card => {
                const cardElement = document.createElement('div');
                cardElement.classList.add('memory-card');
                cardElement.setAttribute('data-id', card.id);
                
                // 添加基本样式以确保可见性
                cardElement.style.width = '100%';
                cardElement.style.height = '100%';
                cardElement.style.minHeight = '60px';
                
                const frontFace = document.createElement('div');
                frontFace.classList.add('front-face');
                frontFace.innerHTML = `<i class="fas ${card.symbol}"></i>`;
                
                const backFace = document.createElement('div');
                backFace.classList.add('back-face');
                backFace.innerHTML = `<i class="fas fa-question"></i>`;
                
                cardElement.appendChild(frontFace);
                cardElement.appendChild(backFace);
                
                // Add click event listener
                cardElement.addEventListener('click', () => this.flipCard(card));
                
                fragment.appendChild(cardElement);
            });
            
            // 一次性添加所有卡片
            this.cardsContainer.appendChild(fragment);
            console.log('Rendered', this.cards.length, 'cards to the game board');
        }
        
        flipCard(card) {
            // Prevent flipping if game is inactive or card is already flipped/matched
            if (!this.gameActive || card.isFlipped || card.isMatched) return;
            
            // Start timer on first card flip
            if (!this.gameStarted) {
                this.startTimer();
                this.gameStarted = true;
            }
            
            // Update card state
            card.isFlipped = true;
            
            // Add to flipped cards array
            this.flippedCards.push(card);
            
            // Update the UI to show the flipped card
            this.updateCardUI(card);
            
            // Check if we have flipped 2 cards
            if (this.flippedCards.length === 2) {
                // Increment moves counter
                this.moves++;
                this.updateMovesText();
                
                // Check for a match
                this.checkForMatch();
            }
        }
        
        updateCardUI(card) {
            const cardElement = document.querySelector(`.memory-card[data-id="${card.id}"]`);
            
            if (card.isFlipped || card.isMatched) {
                cardElement.classList.add('flip');
            } else {
                cardElement.classList.remove('flip');
            }
            
            // 添加匹配状态的类
            if (card.isMatched) {
                cardElement.classList.add('matched');
            } else {
                cardElement.classList.remove('matched');
            }
        }
        
        checkForMatch() {
            const [card1, card2] = this.flippedCards;
            
            // If symbols match
            if (card1.symbol === card2.symbol) {
                this.handleMatch(card1, card2);
            } else {
                this.handleMismatch(card1, card2);
            }
        }
        
        handleMatch(card1, card2) {
            // Update card state
            card1.isMatched = true;
            card2.isMatched = true;
            
            // 添加匹配效果
            this.updateCardUI(card1);
            this.updateCardUI(card2);
            
            // 播放匹配成功的视觉效果
            this.playMatchedAnimation(card1, card2);
            
            // Increment matched pairs counter
            this.matchedPairs++;
            
            // Check if game is won
            if (this.matchedPairs === this.totalCards / 2) {
                this.handleGameWin();
            }
            
            // Reset flipped cards array for the next pair
            this.flippedCards = [];
        }
        
        // 匹配成功的视觉效果
        playMatchedAnimation(card1, card2) {
            const card1Element = document.querySelector(`.memory-card[data-id="${card1.id}"]`);
            const card2Element = document.querySelector(`.memory-card[data-id="${card2.id}"]`);
            
            // 添加短暂的缩放效果
            [card1Element, card2Element].forEach(elem => {
                elem.style.transform = 'rotateY(180deg) scale(1.1)';
                setTimeout(() => {
                    elem.style.transform = 'rotateY(180deg)';
                }, 300);
            });
        }
        
        handleMismatch(card1, card2) {
            // Temporarily disable further flips
            this.gameActive = false;
            
            // Wait a bit, then flip cards back
            setTimeout(() => {
                card1.isFlipped = false;
                card2.isFlipped = false;
                
                // Update UI
                this.updateCardUI(card1);
                this.updateCardUI(card2);
                
                // Reset flipped cards array for the next pair
                this.flippedCards = [];
                
                // Re-enable game
                this.gameActive = true;
            }, 1000);
        }
        
        handleGameWin() {
            this.clearTimer();
            this.gameActive = false;
            
            setTimeout(() => {
                // 获取当前语言环境
                const currentLang = localStorage.getItem('language') || 
                                  (navigator.language || navigator.userLanguage).split('-')[0];
                
                // 根据语言环境生成祝贺消息
                const lang = ['zh', 'en'].includes(currentLang) ? currentLang : 'en';
                
                // 获取翻译源
                const translationSource = this.getTranslationSource(lang);
                
                // 生成祝贺消息
                let congratsMessage = '';
                if (translationSource && translationSource[lang] && translationSource[lang].congratulations) {
                    congratsMessage = translationSource[lang].congratulations;
                } else {
                    // 使用硬编码的默认消息
                    congratsMessage = lang === 'zh' 
                        ? '恭喜！您用了 {moves} 步和 {seconds} 秒完成了游戏。' 
                        : 'Congratulations! You completed the game in {moves} moves and {seconds} seconds.';
                }
                
                // 替换占位符
                congratsMessage = congratsMessage.replace('{moves}', this.moves).replace('{seconds}', this.timer);
                
                alert(congratsMessage);
                
                // 短暂延迟后重新开始游戏
                setTimeout(() => {
                    this.initGame();
                }, 1000);
            }, 500);
        }
        
        updateMovesText() {
            // 获取当前语言环境
            const currentLang = localStorage.getItem('language') || 
                              (navigator.language || navigator.userLanguage).split('-')[0];
            
            // 根据语言环境生成移动次数文本
            const lang = ['zh', 'en'].includes(currentLang) ? currentLang : 'en';
            
            // 获取翻译源
            const translationSource = this.getTranslationSource(lang);
            
            // 获取移动次数文本
            let movesText = 'moves';
            if (translationSource && translationSource[lang] && translationSource[lang].moves) {
                movesText = translationSource[lang].moves;
            }
            
            this.movesElement.textContent = `${this.moves} ${movesText}`;
        }
        
        startTimer() {
            this.clearTimer();
            this.timerInterval = setInterval(() => {
                this.timer++;
                this.updateTimerText();
            }, 1000);
        }
        
        updateTimerText() {
            // 获取当前语言环境
            const currentLang = localStorage.getItem('language') || 
                              (navigator.language || navigator.userLanguage).split('-')[0];
            
            // 根据语言环境生成计时器文本
            const lang = ['zh', 'en'].includes(currentLang) ? currentLang : 'en';
            
            // 获取翻译源
            const translationSource = this.getTranslationSource(lang);
            
            // 获取计时器文本
            let timeText = 'Time:';
            let secondsText = 's';
            
            if (translationSource && translationSource[lang]) {
                if (translationSource[lang].time) {
                    timeText = translationSource[lang].time;
                }
                
                if (translationSource[lang].seconds) {
                    secondsText = translationSource[lang].seconds;
                } else if (lang === 'zh') {
                    secondsText = '秒';
                }
            }
            
            this.timerElement.textContent = `${timeText} ${this.timer}${secondsText}`;
        }
        
        clearTimer() {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
        }
    }
    
    // 暴露MemoryGame类到全局，便于调试
    window.MemoryGame = MemoryGame;
})(); 