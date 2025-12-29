// memory-game.js

(function() {
    // Helper function to log messages consistently
    function log(message) {
        console.log('[MemoryGame]', message);
    }

    class MemoryGame {
        constructor(gameContainerElement) {
            log('Constructing MemoryGame instance.');

            if (!gameContainerElement) {
                log('Error: Game container element not provided to constructor.');
                // If the game container isn't found, we can't proceed.
                // Display an error message directly in the intended game area if possible.
                const featuredGameArea = document.getElementById('featured');
                if (featuredGameArea) {
                    const gameBoardArea = featuredGameArea.querySelector('.game-board');
                    if (gameBoardArea) {
                        gameBoardArea.innerHTML = '<p style="color: red; text-align: center;">Error: Memory Game container not found. Cannot initialize.</p>';
                    }
                }
                return;
            }

            this.gameContainer = gameContainerElement;
            // Selectors are now more specific to the featured game area.
            this.cardsContainer = this.gameContainer.querySelector('.game-board');
            this.movesElement = document.querySelector('#featured .moves');
            this.timerElement = document.querySelector('#featured .timer');
            this.resetButton = document.querySelector('#featured #reset-game');

            if (!this.cardsContainer) {
                log('Error: .game-board not found within the provided game container.');
                 // Display an error message in the featured game's card container if the board specifically is missing.
                if(this.gameContainer) {
                    this.gameContainer.innerHTML = '<p style="color: red; text-align: center;">Error: Game board element missing. Cannot initialize cards.</p>';
                }
                return;
            }
            
            if (!this.movesElement || !this.timerElement || !this.resetButton) {
                log('Warning: One or more control elements (moves, timer, reset) not found. Game might not be fully interactive.');
                // Game can still proceed with card logic, but controls will be non-functional.
            }


            this.totalCards = 16; // Standard 4x4 grid
            this.cards = [];
            this.flippedCards = [];
            this.matchedPairs = 0;
            this.moves = 0;
            this.timer = 0;
            this.timerInterval = null;
            this.gameStarted = false;
            this.gameActive = true; // Game is active by default

            // Card symbols using Font Awesome icons
            this.cardSymbols = [
                'fa-heart', 'fa-star', 'fa-bolt', 'fa-globe',
                'fa-music', 'fa-moon', 'fa-sun', 'fa-car',
                'fa-cloud', 'fa-fire', 'fa-tree', 'fa-bell',
                'fa-gift', 'fa-apple-whole', 'fa-camera', 'fa-house'
            ];
            
            log('MemoryGame constructed. Call initGame() to start/reset.');
            this.setupEventListeners(); // Setup reset button and language change listeners
        }

        initGame() {
            log('Initializing game state and preparing to render cards.');
            if (!this.cardsContainer) {
                log('Cannot initGame: cardsContainer is missing.');
                return;
            }
            this.cardsContainer.innerHTML = ''; // Clear previous cards and any fallback content
            this.cardsContainer.classList.add('js-active'); // Signal JS has taken over, hides CSS spinner

            // Reset game state variables
            this.cards = [];
            this.flippedCards = [];
            this.matchedPairs = 0;
            this.moves = 0;
            this.timer = 0;
            this.gameStarted = false;
            this.gameActive = true;

            // Update UI elements for stats
            if (this.movesElement) this.updateMovesText();
            if (this.timerElement) this.updateTimerText();
            this.clearTimer(); // Stop any existing timer

            this.createCards(); // Prepare card data
            this.renderCards(); // Render cards to the DOM

            // Optional: Implement a welcome animation (e.g., quick flip of all cards)
            // this.showWelcomeAnimation(); 
            log(`Game initialized. Board should now have ${this.cards.length} cards.`);
        }

        createCards() {
            log('Creating card data.');
            // Ensure we have enough symbols for the number of cards
            const symbolsNeeded = this.totalCards / 2;
            if (this.cardSymbols.length < symbolsNeeded) {
                log(`Error: Not enough unique symbols (${this.cardSymbols.length}) for ${symbolsNeeded} pairs.`);
                // Potentially use fallback symbols or repeat symbols if necessary
                // For now, this will result in fewer unique cards if totalCards is too high.
            }
            const selectedSymbols = this.cardSymbols.slice(0, symbolsNeeded);
            const cardPairs = [...selectedSymbols, ...selectedSymbols]; // Create pairs
            const shuffledCards = this.shuffleArray(cardPairs); // Shuffle them

            // Create card objects with IDs and initial states
            this.cards = shuffledCards.map((symbol, index) => ({
                id: index,
                symbol: symbol,
                isFlipped: false,
                isMatched: false
            }));
            log(`${this.cards.length} card objects created.`);
        }

        shuffleArray(array) {
            const shuffled = [...array];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; // ES6 swap
            }
            return shuffled;
        }

        renderCards() {
            log('Rendering cards to the game board.');
            if (!this.cardsContainer) {
                log('Cannot renderCards: cardsContainer is missing!');
                return;
            }
            this.cardsContainer.innerHTML = ''; // Ensure it's empty before rendering new cards

            if (this.cards.length === 0) {
                log('Warning: No cards to render. Game board will be empty.');
                this.cardsContainer.textContent = 'Error: No cards were generated to display.';
                return;
            }

            const fragment = document.createDocumentFragment(); // Efficient way to append multiple elements

            this.cards.forEach(card => {
                const cardElement = document.createElement('div');
                cardElement.classList.add('memory-card');
                cardElement.setAttribute('data-id', card.id);
                
                // Card faces
                const frontFace = document.createElement('div');
                frontFace.classList.add('front-face');
                frontFace.innerHTML = `<i class="fas ${card.symbol}"></i>`;
                
                const backFace = document.createElement('div');
                backFace.classList.add('back-face');
                backFace.innerHTML = `<i class="fas fa-question"></i>`; // Question mark for back
                
                cardElement.appendChild(frontFace);
                cardElement.appendChild(backFace);
                
                // Add click event listener to flip the card
                cardElement.addEventListener('click', () => this.flipCard(card));
                fragment.appendChild(cardElement);
            });

            this.cardsContainer.appendChild(fragment);
            log(`Rendered ${this.cards.length} card elements to the game board.`);
            
            if (this.cardsContainer.children.length > 0) {
                log(`Game board now contains ${this.cardsContainer.children.length} card elements.`);
            } else if (this.cards.length > 0) {
                log('CRITICAL: Cards were generated but not appended to cardsContainer!');
            } else {
                log('Game board is empty after renderCards (no cards were generated).');
            }
        }

        flipCard(card) {
            if (!this.gameActive || card.isFlipped || card.isMatched || this.flippedCards.length >= 2) {
                // Prevent flipping more than 2 cards, or already flipped/matched cards, or if game is paused
                return;
            }

            if (!this.gameStarted) {
                this.startTimer();
                this.gameStarted = true;
            }

            card.isFlipped = true;
            this.flippedCards.push(card);
            this.updateCardUI(card); // Reflect flip in the DOM

            if (this.flippedCards.length === 2) {
                this.moves++;
                if(this.movesElement) this.updateMovesText();
                this.gameActive = false; // Pause game while checking match
                this.checkForMatch();
            }
        }

        updateCardUI(card) {
            const cardElement = this.cardsContainer.querySelector(`.memory-card[data-id="${card.id}"]`);
            if (cardElement) {
                if (card.isFlipped || card.isMatched) {
                    cardElement.classList.add('flip');
                } else {
                    cardElement.classList.remove('flip');
                }
                if (card.isMatched) {
                    cardElement.classList.add('matched');
                } else {
                    cardElement.classList.remove('matched');
                }
            }
        }

        checkForMatch() {
            const [card1, card2] = this.flippedCards;
            if (card1.symbol === card2.symbol) {
                this.handleMatch(card1, card2);
            } else {
                this.handleMismatch(card1, card2);
            }
        }

        handleMatch(card1, card2) {
            log(`Match found: ${card1.symbol}`);
            card1.isMatched = true;
            card2.isMatched = true;
            this.matchedPairs++;
            
            // No need to call updateCardUI here as .matched class handles visuals via CSS mostly
            // The .flip class is already added.

            this.flippedCards = []; // Clear for next turn
            this.gameActive = true; // Resume game

            if (this.matchedPairs === this.totalCards / 2) {
                this.handleGameWin();
            }
        }

        handleMismatch(card1, card2) {
            log('Mismatch.');
            // Cards remain flipped for a short duration, then flip back
            setTimeout(() => {
                card1.isFlipped = false;
                card2.isFlipped = false;
                this.updateCardUI(card1);
                this.updateCardUI(card2);
                this.flippedCards = [];
                this.gameActive = true; // Resume game
            }, 1000); // 1 second delay before flipping back
        }

        handleGameWin() {
            log('Game won!');
            this.clearTimer();
            this.gameActive = false; // Stop game interaction

            setTimeout(() => {
                const currentLang = localStorage.getItem('language') || (navigator.language || navigator.userLanguage).split('-')[0];
                const lang = ['zh', 'en'].includes(currentLang) ? currentLang : 'en';
                const translationSource = this.getTranslationSource(lang);
                let congratsMessage = (translationSource && translationSource[lang] && translationSource[lang].congratulations)
                    ? translationSource[lang].congratulations
                    : (lang === 'zh' ? '恭喜！您用了 {moves} 步和 {seconds} 秒完成了游戏。' : 'Congratulations! You completed the game in {moves} moves and {seconds} seconds.');
                
                congratsMessage = congratsMessage.replace('{moves}', this.moves).replace('{seconds}', this.timer);
                alert(congratsMessage);
                // Optionally, re-initialize the game automatically or prompt user
                // this.initGame(); 
            }, 500); // Short delay before showing win message
        }
        
        getTranslationSource(lang) {
            if (typeof translations !== 'undefined' && translations && translations[lang]) {
                return translations;
            }
            return null; // No translations found
        }

        updateMovesText() {
            if (!this.movesElement) return;
            const currentLang = localStorage.getItem('language') || (navigator.language || navigator.userLanguage).split('-')[0];
            const lang = ['zh', 'en'].includes(currentLang) ? currentLang : 'en';
            const translationSource = this.getTranslationSource(lang);
            const movesStr = (translationSource && translationSource[lang] && translationSource[lang].moves) ? translationSource[lang].moves : (lang === 'zh' ? '步数' : 'moves');
            this.movesElement.textContent = `${this.moves} ${movesStr}`;
        }

        startTimer() {
            if (!this.timerElement) return;
            this.clearTimer();
            this.gameStarted = true;
            this.timerInterval = setInterval(() => {
                this.timer++;
                this.updateTimerText();
            }, 1000);
        }

        updateTimerText() {
            if (!this.timerElement) return;
            const currentLang = localStorage.getItem('language') || (navigator.language || navigator.userLanguage).split('-')[0];
            const lang = ['zh', 'en'].includes(currentLang) ? currentLang : 'en';
            const translationSource = this.getTranslationSource(lang);
            
            const timeStr = (translationSource && translationSource[lang] && translationSource[lang].time) ? translationSource[lang].time : (lang === 'zh' ? '时间：' : 'Time:');
            const secondsStr = (translationSource && translationSource[lang] && translationSource[lang].seconds) ? translationSource[lang].seconds : (lang === 'zh' ? '秒' : 's');
            
            this.timerElement.textContent = `${timeStr} ${this.timer}${secondsStr}`;
        }

        clearTimer() {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
        }

        setupEventListeners() {
            if (this.resetButton) {
                this.resetButton.addEventListener('click', () => {
                    log('Reset button clicked.');
                    this.initGame(); // Re-initialize the current game instance
                });
            } else {
                log('Warning: Reset button not found during event listener setup.');
            }

            // Listen for language changes to update game text
            document.addEventListener('languageChanged', (e) => {
                log(`Language change detected: ${e.detail.language}. Updating game text.`);
                this.updateGameText(e.detail.language);
            });
            // Initial text update based on current language
            const currentLang = localStorage.getItem('language') || (navigator.language || navigator.userLanguage).split('-')[0];
            this.updateGameText(['zh', 'en'].includes(currentLang) ? currentLang : 'en');
        }

        updateGameText(lang) {
            log(`Updating game text elements for language: ${lang}`);
            if (this.movesElement) this.updateMovesText(); // Will use the new lang
            if (this.timerElement) this.updateTimerText(); // Will use the new lang
            if (this.resetButton) {
                const translationSource = this.getTranslationSource(lang);
                const resetText = (translationSource && translationSource[lang] && translationSource[lang].resetGame) ? translationSource[lang].resetGame : (lang === 'zh' ? '重置游戏' : 'Reset Game');
                this.resetButton.textContent = resetText;
            }
        }

        // Optional welcome animation (can be called after renderCards in initGame)
        // showWelcomeAnimation() {
        //     log('Starting welcome animation.');
        //     if (!this.cardsContainer) return;
        //     const cardElements = this.cardsContainer.querySelectorAll('.memory-card');
        //     if (cardElements.length === 0) return;

        //     cardElements.forEach((card, index) => {
        //         setTimeout(() => card.classList.add('flip'), index * 50); // Staggered flip
        //     });

        //     setTimeout(() => {
        //         cardElements.forEach(card => card.classList.remove('flip'));
        //         log('Welcome animation finished.');
        //     }, cardElements.length * 50 + 1000); // Wait for all to flip then flip back
        // }

    } // End of MemoryGame class

    // Global instance for the featured memory game
    window.featuredMemoryGame = null;

    // This function ensures the game is ready and displayed in the featured section.
    function ensureFeaturedMemoryGameIsReady() {
        log('Ensuring featured memory game is ready...');
        // This is the specific container for the memory game within the #featured section
        const featuredGameElement = document.getElementById('memory-game'); 

        if (!featuredGameElement) {
            log('Error: Featured game element (#memory-game) not found in DOM.');
            // Attempt to display an error message in a broader fallback area if #memory-game itself is missing.
            const featuredSection = document.getElementById('featured');
            if (featuredSection) {
                const container = featuredSection.querySelector('.featured-game-container') || featuredSection;
                container.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">Error: Core game structure (#memory-game) is missing. Cannot load game.</p>';
            }
            return;
        }
        
        // Ensure the game container and its board are visible (CSS might hide them initially)
        featuredGameElement.style.display = 'block'; // Or 'flex', 'grid' as per its layout needs
        const gameBoard = featuredGameElement.querySelector('.game-board');
        if (gameBoard) {
            gameBoard.style.display = 'grid'; // Make sure the board itself is set to display grid
        } else {
            log('Error: .game-board element not found within #memory-game. Cannot initialize.');
            featuredGameElement.innerHTML = '<p style="color: red; text-align: center;">Error: Game board missing. Cannot load cards.</p>';
            return;
        }

        if (!window.featuredMemoryGame) {
            log('No existing featuredMemoryGame instance. Creating new one.');
            // Pass the #memory-game element to the constructor
            window.featuredMemoryGame = new MemoryGame(featuredGameElement);
        }

        // Now, initialize or re-initialize the game.
        if (window.featuredMemoryGame && typeof window.featuredMemoryGame.initGame === 'function') {
            log('Calling initGame() on featuredMemoryGame instance.');
            window.featuredMemoryGame.initGame();
        } else {
            log('Error: featuredMemoryGame instance is not valid or initGame is not available.');
            if(gameBoard) gameBoard.textContent = 'Failed to initialize game logic.';
        }
    }

    // Event listener for when the DOM is fully loaded
    document.addEventListener('DOMContentLoaded', function() {
        log('DOMContentLoaded event fired. Initializing featured game setup.');

        // Prepare the game in the featured section as soon as the DOM is ready.
        // It might be initially off-screen or hidden by CSS, but the JS object will be set up.
        ensureFeaturedMemoryGameIsReady();

        // Find the "PLAY NOW" button for the Memory Match game in the "All Games" list.
        const playNowBtnAllGames = document.querySelector('.game-card[data-category="puzzle"] .play-btn');
        if (playNowBtnAllGames) {
            playNowBtnAllGames.addEventListener('click', function(e) {
                log('Play Now button (from All Games list for Memory Match) clicked.');
                // The href="#featured" attribute on the button handles scrolling to the section.
                // After the scroll (give a tiny delay for the browser to process scroll),
                // ensure the game in the featured section is initialized and visible.
                setTimeout(ensureFeaturedMemoryGameIsReady, 50); // 50ms delay for scroll to settle
            });
        } else {
            log('Warning: "Play Now" button for Memory Match in "All Games" list not found.');
        }
    });

    // Expose the main initialization function to the window scope if needed for debugging or external calls.
    window.ensureFeaturedMemoryGameIsReady = ensureFeaturedMemoryGameIsReady;

})();
