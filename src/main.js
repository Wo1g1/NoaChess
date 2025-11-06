// NoaChess - Simple chess UI using Fairy-Stockfish and Chessground
const Chessground = require('chessgroundx').Chessground;
import Module from 'ffish-es6';

let ffish;
let board;
let game;
let chessground;
let stockfishEngine = null;
let stockfishReady = false;

// Initialize Stockfish (main thread)
function initStockfish() {
  try {
    // Load Stockfish script dynamically
    const script = document.createElement('script');
    script.src = 'stockfish.js';
    script.onload = function() {
      console.log('Stockfish script loaded, initializing...');

      // Initialize Stockfish WASM module
      if (typeof Stockfish !== 'undefined') {
        Stockfish().then(sf => {
          stockfishEngine = sf;

          // Add message listener
          stockfishEngine.addMessageListener((line) => {
            console.log('Stockfish:', line);

            if (line.includes('uciok')) {
              stockfishEngine.postMessage('setoption name UCI_Variant value noachess');
              stockfishEngine.postMessage('isready');
            } else if (line.includes('readyok')) {
              stockfishReady = true;
              console.log('Fairy-Stockfish AI ready!');
            }
          });

          // Start UCI protocol
          stockfishEngine.postMessage('uci');
        }).catch(err => {
          console.error('Failed to initialize Stockfish WASM:', err);
          stockfishReady = false;
        });
      } else {
        console.error('Stockfish function not found');
        stockfishReady = false;
      }
    };
    script.onerror = function() {
      console.log('Failed to load Stockfish, using fallback AI');
      stockfishReady = false;
    };
    document.head.appendChild(script);
  } catch (error) {
    console.log('Stockfish not available, using fallback AI:', error.message);
    stockfishReady = false;
  }
}

// Initialize Fairy-Stockfish
new Module().then((loadedModule) => {
  ffish = loadedModule;
  console.log('Fairy-Stockfish loaded!');

  // Load NoaChess variant
  fetch('./noachess.ini')
    .then(response => response.text())
    .then(ini => {
      ffish.loadVariantConfig(ini);
      console.log('NoaChess variant loaded!');

      // Initialize game first
      initGame();

      // Initialize Stockfish AI (non-blocking)
      setTimeout(() => initStockfish(), 100);
    })
    .catch(error => {
      console.error('Failed to load NoaChess variant:', error);
      updateStatus('Error loading game. Please refresh.');
    });
});

function getMovableColor() {
  const playWhite = document.getElementById('playWhite').checked;
  const playBlack = document.getElementById('playBlack').checked;
  const isWhiteTurn = game.turn();

  // If both checked, allow both colors
  if (playWhite && playBlack) return 'both';

  // If current turn is for a human player, allow that color
  if (isWhiteTurn && playWhite) return 'white';
  if (!isWhiteTurn && playBlack) return 'black';

  // Otherwise, no human moves (AI turn)
  return 'none';
}

function initGame() {
  // Create new game
  game = new ffish.Board('noachess', 'lbqknr/pppppp/6/6/PPPPPP/LBQKNR w - - 0 1');

  // Initialize chessground
  const boardElement = document.getElementById('board');
  chessground = Chessground(boardElement, {
    fen: game.fen(),
    coordinates: true,
    movable: {
      free: false,
      color: getMovableColor(),
      dests: getLegalMoves()
    },
    events: {
      move: onMove
    },
    dimensions: {
      width: 6,
      height: 6
    }
  });

  updateStatus('White to move');

  // Add event listeners for checkboxes
  document.getElementById('playWhite').addEventListener('change', updateMovableColor);
  document.getElementById('playBlack').addEventListener('change', updateMovableColor);
}

function getLegalMoves() {
  const dests = new Map();
  const moves = game.legalMoves().split(' ');

  moves.forEach(move => {
    if (move.length >= 4) {
      const from = move.slice(0, 2);
      const to = move.slice(2, 4);

      if (!dests.has(from)) {
        dests.set(from, []);
      }
      dests.get(from).push(to);
    }
  });

  return dests;
}

function updateMovableColor() {
  chessground.set({
    movable: {
      color: getMovableColor(),
      dests: getLegalMoves()
    }
  });

  // If AI should move now, make the move
  if (shouldAIMove()) {
    setTimeout(makeAIMove, 300);
  } else {
    updateGameStatus();
  }
}

function onMove(from, to) {
  const move = from + to;

  // Check if move is legal
  if (game.legalMoves().includes(move)) {
    game.push(move);

    const turnColor = game.turn() ? 'white' : 'black';
    const movableColor = getMovableColor();

    chessground.set({
      fen: game.fen(),
      turnColor: turnColor,
      movable: {
        color: movableColor,
        dests: getLegalMoves()
      }
    });

    updateGameStatus();

    // AI move
    if (shouldAIMove()) {
      setTimeout(makeAIMove, 300);
    }
  } else {
    // Illegal move, reset position
    chessground.set({
      fen: game.fen()
    });
  }
}

function shouldAIMove() {
  const playWhite = document.getElementById('playWhite').checked;
  const playBlack = document.getElementById('playBlack').checked;
  const isWhiteTurn = game.turn();

  return (isWhiteTurn && !playWhite) || (!isWhiteTurn && !playBlack);
}

function makeAIMove() {
  if (game.isGameOver()) return;

  updateStatus('AI thinking...');

  // Try Stockfish first
  if (stockfishReady && stockfishEngine) {
    const depth = parseInt(document.getElementById('depth').value) || 12;
    let responseReceived = false;

    // Set up temporary message handler for this move
    const tempHandler = (line) => {
      if (line.startsWith('bestmove')) {
        responseReceived = true;
        const parts = line.split(' ');
        const bestMove = parts[1];

        if (bestMove && bestMove !== '(none)') {
          game.push(bestMove);

          chessground.set({
            fen: game.fen(),
            turnColor: game.turn() ? 'white' : 'black',
            movable: {
              color: getMovableColor(),
              dests: getLegalMoves()
            },
            lastMove: [bestMove.slice(0, 2), bestMove.slice(2, 4)]
          });

          updateGameStatus();
        }
      }
    };

    // Add temporary handler
    stockfishEngine.addMessageListener(tempHandler);

    // Send position and search command
    stockfishEngine.postMessage('ucinewgame');
    stockfishEngine.postMessage('position fen ' + game.fen());
    stockfishEngine.postMessage('go depth ' + depth);

    // Fallback timeout
    setTimeout(() => {
      if (!responseReceived) {
        console.log('Stockfish timeout, using fallback AI');
        makeFallbackMove();
      }
    }, 5000);

  } else {
    // Fallback AI
    makeFallbackMove();
  }
}

function makeFallbackMove() {
  setTimeout(() => {
    const moves = game.legalMoves().split(' ').filter(m => m.length >= 4);
    if (moves.length === 0) return;

    // Prioritize captures
    const captureMoves = moves.filter(m => game.isCapture(m));
    let selectedMove;

    if (captureMoves.length > 0) {
      if (Math.random() < 0.7) {
        selectedMove = captureMoves[Math.floor(Math.random() * captureMoves.length)];
      } else {
        selectedMove = moves[Math.floor(Math.random() * moves.length)];
      }
    } else {
      selectedMove = moves[Math.floor(Math.random() * moves.length)];
    }

    game.push(selectedMove);

    chessground.set({
      fen: game.fen(),
      turnColor: game.turn() ? 'white' : 'black',
      movable: {
        color: getMovableColor(),
        dests: getLegalMoves()
      },
      lastMove: [selectedMove.slice(0, 2), selectedMove.slice(2, 4)]
    });

    updateGameStatus();
  }, 300);
}

function updateGameStatus() {
  if (game.isGameOver()) {
    const result = game.result();
    if (result.includes('1-0')) {
      updateStatus('White wins!');
    } else if (result.includes('0-1')) {
      updateStatus('Black wins!');
    } else {
      updateStatus('Draw');
    }

    chessground.set({
      movable: { dests: new Map() }
    });
  } else {
    const turn = game.turn() ? 'White' : 'Black';
    const inCheck = game.isCheck() ? ' (in check!)' : '';
    updateStatus(`${turn} to move${inCheck}`);
  }
}

function updateStatus(message) {
  document.getElementById('status').textContent = message;
}

// Global functions for HTML buttons
window.newGame = function() {
  if (game) game.delete();
  initGame();
}

window.flipBoard = function() {
  chessground.toggleOrientation();
}

window.undoMove = function() {
  if (game && !game.isGameOver()) {
    // Undo 2 moves if playing against AI
    const playWhite = document.getElementById('playWhite').checked;
    const playBlack = document.getElementById('playBlack').checked;
    const count = (playWhite && playBlack) ? 1 : 2;

    for (let i = 0; i < count; i++) {
      const moves = game.moveStack().split(' ');
      if (moves.length > 0 && moves[0] !== '') {
        game.pop();
      }
    }

    const turnColor = game.turn() ? 'white' : 'black';
    const movableColor = getMovableColor();

    chessground.set({
      fen: game.fen(),
      turnColor: turnColor,
      movable: {
        color: movableColor,
        dests: getLegalMoves()
      }
    });

    updateGameStatus();
  }
}
