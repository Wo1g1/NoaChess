// NoaChess - Simple chess UI using Fairy-Stockfish and Chessground
const Chessground = require('chessgroundx').Chessground;
import Module from 'ffish-es6';

let ffish;
let board;
let game;
let chessground;
let stockfishWorker = null;
let stockfishReady = false;

// Initialize Stockfish Worker
function initStockfish() {
  try {
    stockfishWorker = new Worker('stockfish.worker.js');

    stockfishWorker.onmessage = function(event) {
      const message = event.data;
      if (typeof message === 'string') {
        console.log('Stockfish:', message);
        if (message === 'uciok') {
          stockfishReady = true;
          // Set variant
          stockfishWorker.postMessage('setoption name UCI_Variant value noachess');
          stockfishWorker.postMessage('isready');
        } else if (message === 'readyok') {
          console.log('Stockfish ready for NoaChess!');
        }
      }
    };

    stockfishWorker.postMessage('uci');
  } catch(e) {
    console.log('Stockfish worker not available:', e);
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
      initStockfish();
      initGame();
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

  const depth = parseInt(document.getElementById('depth').value) || 12;

  // Try to use Stockfish if available
  if (stockfishReady && stockfishWorker) {
    let bestMove = null;

    const messageHandler = (event) => {
      const message = event.data;
      if (typeof message === 'string') {
        console.log('Engine:', message);
        if (message.startsWith('bestmove')) {
          const parts = message.split(' ');
          bestMove = parts[1];

          stockfishWorker.removeEventListener('message', messageHandler);

          if (bestMove && bestMove !== '(none)') {
            game.push(bestMove);

            const turnColor = game.turn() ? 'white' : 'black';
            const movableColor = getMovableColor();

            chessground.set({
              fen: game.fen(),
              turnColor: turnColor,
              movable: {
                color: movableColor,
                dests: getLegalMoves()
              },
              lastMove: [bestMove.slice(0, 2), bestMove.slice(2, 4)]
            });

            updateGameStatus();
          }
        }
      }
    };

    stockfishWorker.addEventListener('message', messageHandler);
    stockfishWorker.postMessage('ucinewgame');
    stockfishWorker.postMessage(`position fen ${game.fen()}`);
    stockfishWorker.postMessage(`go depth ${depth}`);
  } else {
    // Fallback: Simple AI with capture preference
    const moves = game.legalMoves().split(' ').filter(m => m.length >= 4);
    if (moves.length === 0) return;

    let selectedMove;
    const captureMoves = [];

    moves.forEach(move => {
      if (game.isCapture(move)) {
        captureMoves.push(move);
      }
    });

    // Prefer capture moves 70% of the time
    if (captureMoves.length > 0 && Math.random() < 0.7) {
      selectedMove = captureMoves[Math.floor(Math.random() * captureMoves.length)];
    } else {
      selectedMove = moves[Math.floor(Math.random() * moves.length)];
    }

    if (selectedMove) {
      game.push(selectedMove);

      const turnColor = game.turn() ? 'white' : 'black';
      const movableColor = getMovableColor();

      chessground.set({
        fen: game.fen(),
        turnColor: turnColor,
        movable: {
          color: movableColor,
          dests: getLegalMoves()
        },
        lastMove: [selectedMove.slice(0, 2), selectedMove.slice(2, 4)]
      });

      updateGameStatus();
    }
  }
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
