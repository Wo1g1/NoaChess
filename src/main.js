// NoaChess - Simple chess UI using Minimax AI and Chessground
const Chessground = require('chessgroundx').Chessground;
import Module from 'ffish-es6';

let ffish;
let board;
let game;
let chessground;

// Piece values for evaluation
const PIECE_VALUES = {
  'p': 100, 'P': 100,
  'n': 320, 'N': 320,
  'b': 330, 'B': 330,
  'r': 500, 'R': 500,
  'q': 900, 'Q': 900,
  'l': 350, 'L': 350,  // Leaper
  'g': 100, 'G': 100,  // General (promoted pawn)
  'k': 20000, 'K': 20000
};

// Evaluate board position
function evaluatePosition(boardState) {
  const fen = boardState.fen();
  const pieces = fen.split(' ')[0];

  let score = 0;

  // Material count
  for (let char of pieces) {
    if (char in PIECE_VALUES) {
      const value = PIECE_VALUES[char];
      score += (char === char.toUpperCase()) ? value : -value;
    }
  }

  // Bonus for checkmate
  if (boardState.isGameOver()) {
    const result = boardState.result();
    if (result.includes('1-0')) return 100000;
    if (result.includes('0-1')) return -100000;
    return 0; // Draw
  }

  // Bonus for check
  if (boardState.isCheck()) {
    score += boardState.turn() ? -50 : 50;
  }

  // Mobility (number of legal moves)
  const moves = boardState.legalMoves().split(' ').filter(m => m.length >= 4);
  score += boardState.turn() ? moves.length * 10 : -moves.length * 10;

  return score;
}

// Minimax with Alpha-Beta Pruning
function minimax(boardState, depth, alpha, beta, maximizingPlayer) {
  if (depth === 0 || boardState.isGameOver()) {
    return evaluatePosition(boardState);
  }

  const moves = boardState.legalMoves().split(' ').filter(m => m.length >= 4);

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (let move of moves) {
      const newBoard = boardState.copy();
      newBoard.push(move);
      const evaluation = minimax(newBoard, depth - 1, alpha, beta, false);
      newBoard.delete();
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break; // Beta cutoff
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (let move of moves) {
      const newBoard = boardState.copy();
      newBoard.push(move);
      const evaluation = minimax(newBoard, depth - 1, alpha, beta, true);
      newBoard.delete();
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break; // Alpha cutoff
    }
    return minEval;
  }
}

// Find best move using minimax
function findBestMove(boardState, depth) {
  const moves = boardState.legalMoves().split(' ').filter(m => m.length >= 4);
  const isWhiteTurn = boardState.turn();

  let bestMove = moves[0];
  let bestValue = isWhiteTurn ? -Infinity : Infinity;

  // Order moves: captures first for better pruning
  const orderedMoves = [];
  const captureMoves = [];
  const normalMoves = [];

  for (let move of moves) {
    if (boardState.isCapture(move)) {
      captureMoves.push(move);
    } else {
      normalMoves.push(move);
    }
  }
  orderedMoves.push(...captureMoves, ...normalMoves);

  for (let move of orderedMoves) {
    const newBoard = boardState.copy();
    newBoard.push(move);
    const moveValue = minimax(newBoard, depth - 1, -Infinity, Infinity, !isWhiteTurn);
    newBoard.delete();

    if (isWhiteTurn) {
      if (moveValue > bestValue) {
        bestValue = moveValue;
        bestMove = move;
      }
    } else {
      if (moveValue < bestValue) {
        bestValue = moveValue;
        bestMove = move;
      }
    }
  }

  console.log(`Best move: ${bestMove} (eval: ${bestValue})`);
  return bestMove;
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
      console.log('Using Minimax AI with Alpha-Beta Pruning');

      // Initialize game
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

  setTimeout(() => {
    const depth = parseInt(document.getElementById('depth').value) || 6;
    const startTime = Date.now();

    try {
      const bestMove = findBestMove(game, depth);
      const elapsed = Date.now() - startTime;

      console.log(`Minimax depth ${depth} took ${elapsed}ms`);

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
    } catch (error) {
      console.error('AI move error:', error);
      // Fallback to random move
      makeFallbackMove();
    }
  }, 300);
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
