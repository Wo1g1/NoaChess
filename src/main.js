// NoaChess - Simple chess UI using Fairy-Stockfish and Chessground
const Chessground = require('chessgroundx').Chessground;
import Module from 'ffish-es6';

let ffish;
let board;
let game;
let chessground;

// Fairy-Stockfish engine
let stockfishEngine = null;
let stockfishReady = false;
let variantsIni = '';

// Initialize Fairy-Stockfish engine
function initStockfishEngine() {
  console.log('Initializing Stockfish...');

  // Stockfish is already loaded via script tag in HTML
  if (typeof Stockfish === 'undefined') {
    console.error('Stockfish not found!');
    return;
  }

  // Initialize Stockfish WASM with proper configuration
  Stockfish({
    locateFile: function(path) {
      // Ensure worker files are located in the correct path
      console.log('Locating file:', path);
      return '/' + path;
    }
  }).then(sf => {
    stockfishEngine = sf;
    console.log('Fairy-Stockfish engine initialized');

    // Setup message listener
    stockfishEngine.addMessageListener((line) => {
      console.log('SF:', line);

      if (line.startsWith('Fairy-Stockfish')) {
        // Load variant configuration
        window.prompt = function() {
          return variantsIni + '\nEOF';
        };
        stockfishEngine.postMessage('load <<EOF');
        stockfishEngine.postMessage('uci');
      } else if (line.includes('uciok')) {
        stockfishEngine.postMessage('setoption name UCI_Variant value noachess');
        stockfishEngine.postMessage('isready');
      } else if (line.includes('readyok')) {
        stockfishReady = true;
        console.log('Fairy-Stockfish ready for analysis!');
      }
    });

    // Start engine
    stockfishEngine.postMessage('uci');
  }).catch(err => {
    console.error('Failed to initialize Stockfish:', err);
  });
}

// Initialize Fairy-Stockfish
new Module().then((loadedModule) => {
  ffish = loadedModule;
  console.log('ffish-es6 loaded!');

  // Load NoaChess variant
  fetch('./noachess.ini')
    .then(response => response.text())
    .then(ini => {
      variantsIni = ini;
      ffish.loadVariantConfig(ini);
      console.log('NoaChess variant loaded!');

      // Initialize game
      initGame();

      // Initialize Stockfish engine
      initStockfishEngine();
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
  let move = from + to;

  // Check if this is a promotion move
  const legalMoves = game.legalMoves().split(' ');

  // Find the actual legal move (might include promotion piece)
  let actualMove = move;
  for (let legalMove of legalMoves) {
    if (legalMove.startsWith(move)) {
      actualMove = legalMove;
      break;
    }
  }

  // Check if move is legal
  if (legalMoves.includes(actualMove)) {
    game.push(actualMove);

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

  if (stockfishReady && stockfishEngine) {
    const depth = parseInt(document.getElementById('depth').value) || 12;
    let bestMove = null;

    // Temporary listener for this search
    const searchListener = (line) => {
      if (line.startsWith('bestmove')) {
        const parts = line.split(' ');
        bestMove = parts[1];

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

        // Remove this listener after getting bestmove
        stockfishEngine.removeMessageListener(searchListener);
      }
    };

    stockfishEngine.addMessageListener(searchListener);

    // Send search command
    stockfishEngine.postMessage('position fen ' + game.fen());
    stockfishEngine.postMessage('go depth ' + depth);

    // Fallback timeout
    setTimeout(() => {
      if (!bestMove) {
        console.log('Stockfish timeout, using fallback');
        stockfishEngine.removeMessageListener(searchListener);
        makeFallbackMove();
      }
    }, 30000); // 30 second timeout

  } else {
    // Fallback if Stockfish not ready
    setTimeout(makeFallbackMove, 300);
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
