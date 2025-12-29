# GameVerse - Mini Game Collection

GameVerse is a modern, responsive website that hosts a collection of browser-based mini-games. Currently, it features a Memory Match game, with plans to add more games in the future.

## Features

- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Dark/Light Theme**: Toggle between dark and light modes with user preference saved
- **Game Filtering**: Filter games by category
- **Smooth Animations**: Scroll animations and interactive UI elements
- **Memory Match Game**: A fully functional memory card matching game
- **Tic Tac Toe**: Play two-player or vs computer
- **Snake**: Classic snake game with score + high score
- **2048**: Swipe/keyboard controls with score tracking
- **Flappy Bird**: Canvas arcade game with best score
- **Solitaire**: Click-to-move Klondike-style solitaire

## Technologies Used

- HTML5
- CSS3 (with CSS variables for theming)
- JavaScript (ES6+)
- Font Awesome for icons
- Google Fonts

## Memory Match Game

The featured game is a classic memory matching game:
- Click cards to flip them
- Find matching pairs of cards
- Track your moves and time
- Reset the game at any time

## Future Games

The website includes placeholders for several upcoming games:
- Snake
- Tic Tac Toe
- Flappy Bird
- 2048
- Solitaire

## Setup and Usage

1. Clone this repository
2. Open the `index.html` file in your browser

Optional (recommended): run a local static server (avoids some `file://` browser limitations):

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` and click `index.html`.

No build process or server is required to run this project as it's built with vanilla HTML, CSS, and JavaScript.

## Project Structure

```
├── index.html               # Main HTML file
├── styles.css               # Main site styles
├── game-cards.css           # Game card preview styles
├── game-page.css            # Shared styles for standalone game pages
├── script.js                # General website JavaScript
├── memory-game.js           # Memory Match game JavaScript
├── 2048.html                # 2048 game page
├── 2048-anim.js             # 2048 game logic (animations/undo/hint)
├── 2048.css                 # 2048 styles
├── tic-tac-toe.html         # Tic Tac Toe game page
├── tic-tac-toe.js           # Tic Tac Toe game logic
├── snake.html               # Snake game page
├── snake.js                 # Snake game logic
├── flappy-bird.html         # Flappy Bird game page
├── flappy-bird.js           # Flappy Bird game logic
├── solitaire.html           # Solitaire game page
├── solitaire.js             # Solitaire game logic
├── solitaire.css            # Solitaire styles
├── translations.js          # Primary translations (zh/en)
├── fallback-translations.js # ASCII-only fallback translations
├── test-encoding.html       # Encoding sanity check page
└── README.md                # Project documentation
```

## Browser Compatibility

The website is compatible with all modern browsers:
- Chrome
- Firefox
- Safari
- Edge

## License

This project is open source and available under the MIT License. 
