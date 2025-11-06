// NoaChess - Simple chess UI using Fairy-Stockfish and Chessground
const Chessground = require('chessgroundx').Chessground;
import Module from 'ffish-es6';

let ffish;
let board;
let game;
let chessground;

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
  setTimeout(() => {
    const squares = document.querySelectorAll('cg-board square');
    squares.forEach(square => {
      const style = square.getAttribute('style');
      if (!style) return;

      // Extract translate coordinates
      const match = style.match(/translate\((\d+)px,\s*(\d+)px\)/);
      if (!match) return;

      const x = parseInt(match[1]);
      const y = parseInt(match[2]);

      // Convert pixel coordinates to file/rank (assuming 100px per square)
      const file = Math.floor(x / 100);  // 0-5 (a-f)
      const rank = Math.floor(y / 100);  // 0-5 (1-6)

      // Board colors alternate: (file + rank) even = light, odd = dark
      if ((file + rank) % 2 === 0) {
        square.style.backgroundColor = '#f0d9b5';  // light brown
      } else {
        square.style.backgroundColor = '#b58863';  // dark brown
      }
    });
  }, 100);
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

// Piece values for evaluation
const PIECE_VALUES = {
  'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 20000,
  'l': 350, 'g': 100,  // NoaChess custom pieces
  'P': 100, 'N': 320, 'B': 330, 'R': 500, 'Q': 900, 'K': 20000,
  'L': 350, 'G': 100
};

function evaluatePosition() {
  if (game.isGameOver()) {
    if (game.result() === '0-1') return game.turn() ? -20000 : 20000;
    if (game.result() === '1-0') return game.turn() ? 20000 : -20000;
    return 0;  // Draw
  }

  let score = 0;
  const fen = game.fen();
  const board = fen.split(' ')[0];

  // Count material
  for (let char of board) {
    if (PIECE_VALUES[char]) {
      score += char === char.toUpperCase() ? PIECE_VALUES[char] : -PIECE_VALUES[char];
    }
  }

  return game.turn() ? score : -score;  // Negate if black to move
}

function minimax(depth, alpha, beta, maximizingPlayer) {
  if (depth === 0 || game.isGameOver()) {
    return evaluatePosition();
  }

  const moves = game.legalMoves().split(' ').filter(m => m.length >= 4);

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (let move of moves) {
      game.push(move);
      const evaluation = minimax(depth - 1, alpha, beta, false);
      game.pop();
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;  // Alpha-beta pruning
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (let move of moves) {
      game.push(move);
      const evaluation = minimax(depth - 1, alpha, beta, true);
      game.pop();
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;  // Alpha-beta pruning
    }
    return minEval;
  }
}

function findBestMove(depth) {
  const moves = game.legalMoves().split(' ').filter(m => m.length >= 4);
  if (moves.length === 0) return null;

  let bestMove = moves[0];
  let bestValue = -Infinity;

  // Prioritize captures
  const captureMoves = moves.filter(m => game.isCapture(m));
  const searchMoves = captureMoves.length > 0 ? [...captureMoves, ...moves] : moves;

  for (let move of searchMoves) {
    game.push(move);
    const moveValue = -minimax(depth - 1, -Infinity, Infinity, false);
    game.pop();

    if (moveValue > bestValue) {
      bestValue = moveValue;
      bestMove = move;
    }
  }

  return bestMove;
}

function makeAIMove() {
  if (game.isGameOver()) return;

  updateStatus('AI thinking...');

  setTimeout(() => {
    const depth = Math.min(parseInt(document.getElementById('depth').value) || 4, 6);
    const bestMove = findBestMove(depth);

    if (bestMove) {
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
  }, 100);
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
