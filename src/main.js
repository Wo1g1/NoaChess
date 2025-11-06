// NoaChess - Simple chess UI using Fairy-Stockfish and Chessground
const Chessground = require('chessgroundx').Chessground;
import Module from 'ffish-es6';

let ffish;
let board;
let game;
let chessground;
let stockfish = null;
let stockfishReady = false;

// Initialize Stockfish AI
function initStockfish() {
  if (typeof Stockfish === 'undefined') {
    console.log('Stockfish not available, AI disabled');
    return;
  }

  Stockfish().then(sf => {
    stockfish = sf;

    stockfish.addMessageListener(msg => {
      console.log('Stockfish:', msg);
    });

    stockfish.postMessage('uci');
    stockfish.postMessage('setoption name UCI_Variant value noachess');
    stockfish.postMessage('isready');

    setTimeout(() => {
      stockfishReady = true;
      console.log('Fairy-Stockfish AI ready!');
    }, 500);
  }).catch(err => {
    console.error('Failed to load Stockfish:', err);
  });
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

  // Apply board colors
  applyBoardColors();
}

function applyBoardColors() {
  // Try multiple times to ensure squares are rendered
  const tryApply = (attempts = 0) => {
    const squares = document.querySelectorAll('cg-board square');

    if (squares.length === 0 && attempts < 10) {
      setTimeout(() => tryApply(attempts + 1), 100);
      return;
    }

    console.log(`Applying colors to ${squares.length} squares`);

    squares.forEach(square => {
      const style = square.getAttribute('style');
      if (!style) return;

      // Extract translate coordinates
      const match = style.match(/translate\((-?\d+)px,\s*(-?\d+)px\)/);
      if (!match) return;

      const x = parseInt(match[1]);
      const y = parseInt(match[2]);

      // Convert pixel coordinates to file/rank (assuming 100px per square)
      const file = Math.floor(x / 100);  // 0-5 (a-f)
      const rank = Math.floor(y / 100);  // 0-5 (1-6)

      // Board colors alternate: (file + rank) even = light, odd = dark
      const color = (file + rank) % 2 === 0 ? '#f0d9b5' : '#b58863';
      square.style.setProperty('background-color', color, 'important');

      console.log(`Square ${file},${rank}: ${color}`);
    });
  };

  setTimeout(() => tryApply(), 100);
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

  if (!stockfishReady || !stockfish) {
    // Fallback: random move
    setTimeout(() => {
      const moves = game.legalMoves().split(' ').filter(m => m.length >= 4);
      if (moves.length === 0) return;

      const move = moves[Math.floor(Math.random() * moves.length)];
      game.push(move);

      chessground.set({
        fen: game.fen(),
        turnColor: game.turn() ? 'white' : 'black',
        movable: {
          color: getMovableColor(),
          dests: getLegalMoves()
        },
        lastMove: [move.slice(0, 2), move.slice(2, 4)]
      });

      updateGameStatus();
    }, 300);
    return;
  }

  // Use Fairy-Stockfish
  const depth = parseInt(document.getElementById('depth').value) || 12;
  let bestMove = null;

  const messageHandler = (msg) => {
    if (msg.startsWith('bestmove')) {
      const parts = msg.split(' ');
      bestMove = parts[1];

      stockfish.removeMessageListener(messageHandler);

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

  stockfish.addMessageListener(messageHandler);
  stockfish.postMessage('ucinewgame');
  stockfish.postMessage(`position fen ${game.fen()}`);
  stockfish.postMessage(`go depth ${depth}`);
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
