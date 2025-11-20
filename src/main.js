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

// Auto-play system
let autoPlayMode = false;
let autoPlayGames = [];
let autoPlayCount = 0;
let autoPlayTarget = 0;
let currentGameMoves = [];
let currentEvaluation = 0; // Current position evaluation in centipawns

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
      console.log('NoaChess INI content:', ini);
      ffish.loadVariantConfig(ini);
      console.log('NoaChess variant loaded!');
      console.log('Available variants:', ffish.variants());

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
  console.log('Game initialized with variant:', game.variant());
  console.log('Legal moves from start:', game.legalMoves());

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

  // Debug: log piece movements
  dests.forEach((destinations, square) => {
    console.log(`${square} can move to:`, destinations.join(', '));
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

  // Get all legal moves
  const legalMoves = game.legalMoves().split(' ').filter(m => m.length >= 4);

  console.log('Attempting move:', move);
  console.log('Legal moves:', legalMoves.filter(m => m.startsWith(from)));

  // Find the actual legal move (might include promotion piece)
  let actualMove = null;

  // First, try exact match
  if (legalMoves.includes(move)) {
    actualMove = move;
  } else {
    // Try to find a move that starts with our move (promotion case)
    const matchingMoves = legalMoves.filter(m => m.startsWith(move));
    if (matchingMoves.length > 0) {
      actualMove = matchingMoves[0]; // Take first matching (should be promotion)
      console.log('Found promotion move:', actualMove);
    }
  }

  // Check if move is legal
  if (actualMove && legalMoves.includes(actualMove)) {
    console.log('Executing move:', actualMove);
    game.push(actualMove);
    currentGameMoves.push(actualMove); // Record move

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

    // Request evaluation update after user move
    requestEvaluation();

    // AI move
    if (shouldAIMove()) {
      setTimeout(makeAIMove, 300);
    }
  } else {
    // Illegal move, reset position
    console.log('Illegal move:', move);
    chessground.set({
      fen: game.fen()
    });
  }
}

function shouldAIMove() {
  const playWhite = document.getElementById('playWhite').checked;
  const playBlack = document.getElementById('playBlack').checked;
  const isWhiteTurn = game.turn();

  // If both unchecked, AI plays both sides
  if (!playWhite && !playBlack) return true;

  return (isWhiteTurn && !playWhite) || (!isWhiteTurn && !playBlack);
}

function makeAIMove() {
  if (game.isGameOver()) return;

  updateStatus('AI thinking...');

  const difficulty = document.querySelector('input[name="difficulty"]:checked').value;

  // Use minimax for easy mode, Stockfish for hard mode
  if (difficulty === 'easy') {
    makeMinimaxMove();
    return;
  }

  if (stockfishReady && stockfishEngine) {
    const depth = 12;
    let bestMove = null;

    // Temporary listener for this search
    const searchListener = (line) => {
      // Parse evaluation from info lines - only use final depth
      if (line.startsWith('info') && line.includes('score')) {
        const depthMatch = line.match(/depth (\d+)/);
        const currentDepth = depthMatch ? parseInt(depthMatch[1]) : 0;

        // Only update graph at final depth to avoid flickering
        if (currentDepth >= depth) {
          const cpMatch = line.match(/score cp (-?\d+)/);
          const mateMatch = line.match(/score mate (-?\d+)/);

          if (cpMatch) {
            currentEvaluation = parseInt(cpMatch[1]);
            if (!autoPlayMode) updateEvaluationGraph(currentEvaluation);
          } else if (mateMatch) {
            const mateIn = parseInt(mateMatch[1]);
            currentEvaluation = mateIn > 0 ? 3000 : -3000;
            if (!autoPlayMode) updateEvaluationGraph(currentEvaluation);
          }
        }
      }

      if (line.startsWith('bestmove')) {
        const parts = line.split(' ');
        bestMove = parts[1];

        if (bestMove && bestMove !== '(none)') {
          game.push(bestMove);
          currentGameMoves.push(bestMove); // Record move

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

          // Continue AI vs AI if both unchecked
          if (shouldAIMove()) {
            setTimeout(makeAIMove, 300);
          }
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
    currentGameMoves.push(selectedMove); // Record move

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

// Simple minimax AI for easy mode
function makeMinimaxMove() {
  setTimeout(() => {
    const bestMove = findBestMove(4); // depth 4

    if (bestMove) {
      game.push(bestMove);
      currentGameMoves.push(bestMove); // Record move

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

      // Update evaluation graph with minimax score
      const evalScore = evaluatePosition();
      updateEvaluationGraph(evalScore);

      // Continue AI vs AI if both unchecked
      if (shouldAIMove()) {
        setTimeout(makeAIMove, 300);
      }
    }
  }, 100);
}

function findBestMove(depth) {
  const moves = game.legalMoves().split(' ').filter(m => m.length >= 4);
  if (moves.length === 0) return null;

  let bestMove = null;
  let bestScore = -Infinity;
  const isMaximizing = game.turn(); // true = white, false = black

  for (const move of moves) {
    game.push(move);
    const score = minimax(depth - 1, -Infinity, Infinity, !isMaximizing);
    game.pop();

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

function minimax(depth, alpha, beta, isMaximizing) {
  if (depth === 0 || game.isGameOver()) {
    return evaluatePosition();
  }

  const moves = game.legalMoves().split(' ').filter(m => m.length >= 4);

  if (isMaximizing) {
    let maxScore = -Infinity;
    for (const move of moves) {
      game.push(move);
      const score = minimax(depth - 1, alpha, beta, false);
      game.pop();
      maxScore = Math.max(maxScore, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break; // Alpha-beta pruning
    }
    return maxScore;
  } else {
    let minScore = Infinity;
    for (const move of moves) {
      game.push(move);
      const score = minimax(depth - 1, alpha, beta, true);
      game.pop();
      minScore = Math.min(minScore, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) break; // Alpha-beta pruning
    }
    return minScore;
  }
}

function evaluatePosition() {
  if (game.isGameOver()) {
    const result = game.result();
    if (result.includes('1-0')) return 10000; // White wins
    if (result.includes('0-1')) return -10000; // Black wins
    return 0; // Draw
  }

  // Simple material evaluation
  const pieceValues = {
    'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'l': 350, 'g': 150, 'k': 0
  };

  const fen = game.fen();
  let score = 0;

  for (const char of fen) {
    if (pieceValues[char.toLowerCase()]) {
      const value = pieceValues[char.toLowerCase()];
      score += char === char.toUpperCase() ? value : -value;
    }
  }

  // Small random factor to avoid repetition
  score += Math.random() * 10 - 5;

  return score;
}

function updateGameStatus() {
  if (game.isGameOver()) {
    const result = game.result();
    let winner = 'draw';
    if (result.includes('1-0')) {
      updateStatus('White wins!');
      winner = 'white';
    } else if (result.includes('0-1')) {
      updateStatus('Black wins!');
      winner = 'black';
    } else {
      updateStatus('Draw');
    }

    chessground.set({
      movable: { dests: new Map() }
    });

    // Save game record
    saveGameRecord(winner);

    // Auto-play next game if enabled
    if (autoPlayMode && autoPlayCount < autoPlayTarget) {
      setTimeout(() => {
        newGame();
        setTimeout(makeAIMove, 500);
      }, 1000);
    } else if (autoPlayMode && autoPlayCount >= autoPlayTarget) {
      autoPlayMode = false;
      updateStatus(`Auto-play complete! ${autoPlayCount} games finished.`);
      updateAutoPlayUI();
      // Switch back to evaluation mode
      updateEvaluationGraph(0);
    }
  } else {
    const turn = game.turn() ? 'White' : 'Black';
    const inCheck = game.isCheck() ? ' (in check!)' : '';
    updateStatus(`${turn} to move${inCheck}`);
  }
}

function updateStatus(message) {
  document.getElementById('status').textContent = message;
}

// Save game record
function saveGameRecord(winner) {
  const gameRecord = {
    id: autoPlayGames.length + 1,
    timestamp: new Date().toISOString(),
    moves: [...currentGameMoves],
    moveCount: currentGameMoves.length,
    winner: winner,
    opening: currentGameMoves.slice(0, Math.min(6, currentGameMoves.length)).join(' ')
  };

  autoPlayGames.push(gameRecord);
  autoPlayCount++;

  console.log(`Game ${autoPlayCount} saved:`, gameRecord);

  // Update UI
  if (autoPlayMode) {
    updateStatus(`Game ${autoPlayCount}/${autoPlayTarget} - ${winner} wins`);
  }

  // Update stats display
  updateStatsDisplay();
}

// Auto-play functions
window.startAutoPlay = function() {
  const numGames = parseInt(document.getElementById('autoPlayCount').value) || 10;
  autoPlayTarget = numGames;
  autoPlayMode = true;
  autoPlayGames = [];
  autoPlayCount = 0;

  // Force AI vs AI mode
  document.getElementById('playWhite').checked = false;
  document.getElementById('playBlack').checked = false;

  updateAutoPlayUI();
  updateStatus(`Starting auto-play: ${numGames} games...`);

  // Switch graph to winrate mode
  updateWinrateGraph(0, 0, 0);

  // Start first game
  newGame();
  setTimeout(makeAIMove, 500);
}

window.stopAutoPlay = function() {
  autoPlayMode = false;
  updateAutoPlayUI();
  updateStatus(`Auto-play stopped. ${autoPlayCount} games completed.`);

  // Switch back to evaluation mode
  updateEvaluationGraph(0);
}

function updateAutoPlayUI() {
  const startBtn = document.getElementById('startAutoPlay');
  const stopBtn = document.getElementById('stopAutoPlay');
  const downloadBtn = document.getElementById('downloadGames');

  if (startBtn && stopBtn) {
    startBtn.disabled = autoPlayMode;
    stopBtn.disabled = !autoPlayMode;
  }

  if (downloadBtn) {
    downloadBtn.disabled = autoPlayGames.length === 0;
  }
}

window.downloadGames = function() {
  if (autoPlayGames.length === 0) {
    alert('No games to download!');
    return;
  }

  // Calculate statistics
  const stats = calculateOpeningStats();

  const data = {
    totalGames: autoPlayGames.length,
    statistics: stats,
    games: autoPlayGames
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `noachess-games-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  updateStatus(`Downloaded ${autoPlayGames.length} games!`);
}

function calculateOpeningStats() {
  const openingCounts = {};
  const openingWins = {};

  autoPlayGames.forEach(game => {
    const opening = game.opening;
    if (!openingCounts[opening]) {
      openingCounts[opening] = 0;
      openingWins[opening] = { white: 0, black: 0, draw: 0 };
    }
    openingCounts[opening]++;
    openingWins[opening][game.winner]++;
  });

  const stats = [];
  for (const opening in openingCounts) {
    stats.push({
      opening: opening,
      count: openingCounts[opening],
      whiteWins: openingWins[opening].white,
      blackWins: openingWins[opening].black,
      draws: openingWins[opening].draw
    });
  }

  // Sort by count
  stats.sort((a, b) => b.count - a.count);

  return stats;
}

function updateStatsDisplay() {
  const statsEl = document.getElementById('autoPlayStats');
  if (!statsEl) return;

  if (autoPlayGames.length === 0) {
    statsEl.innerHTML = '<p>No games played yet.</p>';
    if (autoPlayMode) updateWinrateGraph(0, 0, 0);
    return;
  }

  const whiteWins = autoPlayGames.filter(g => g.winner === 'white').length;
  const blackWins = autoPlayGames.filter(g => g.winner === 'black').length;
  const draws = autoPlayGames.filter(g => g.winner === 'draw').length;

  statsEl.innerHTML = `
    <p><strong>Games played:</strong> ${autoPlayGames.length}</p>
    <p><strong>White wins:</strong> ${whiteWins} (${(whiteWins/autoPlayGames.length*100).toFixed(1)}%)</p>
    <p><strong>Black wins:</strong> ${blackWins} (${(blackWins/autoPlayGames.length*100).toFixed(1)}%)</p>
    <p><strong>Draws:</strong> ${draws} (${(draws/autoPlayGames.length*100).toFixed(1)}%)</p>
  `;

  // Update winrate graph only in autoplay mode
  if (autoPlayMode) {
    updateWinrateGraph(whiteWins, blackWins, draws);
  }
}

function requestEvaluation() {
  if (!stockfishReady || !stockfishEngine || autoPlayMode) return;

  const evalDepth = 10;
  let lastEvaluation = 0;

  // Quick evaluation at depth 10 for responsiveness
  const evalListener = (line) => {
    if (line.startsWith('info') && line.includes('score')) {
      const depthMatch = line.match(/depth (\d+)/);
      const currentDepth = depthMatch ? parseInt(depthMatch[1]) : 0;

      // Only store final depth evaluation
      if (currentDepth >= evalDepth) {
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);

        if (cpMatch) {
          lastEvaluation = parseInt(cpMatch[1]);
        } else if (mateMatch) {
          const mateIn = parseInt(mateMatch[1]);
          lastEvaluation = mateIn > 0 ? 3000 : -3000;
        }
      }
    }

    if (line.startsWith('bestmove')) {
      stockfishEngine.removeMessageListener(evalListener);
      // Update graph with final evaluation
      updateEvaluationGraph(lastEvaluation);
    }
  };

  stockfishEngine.addMessageListener(evalListener);
  stockfishEngine.postMessage('position fen ' + game.fen());
  stockfishEngine.postMessage('go depth ' + evalDepth);
}

function updateEvaluationGraph(evalCp) {
  // Convert centipawns to percentage (500cp = 100% advantage)
  const maxCp = 500;
  let percent = Math.min(Math.max(evalCp / maxCp * 50, -50), 50);

  // Calculate bar heights
  // 50% = center (equal position)
  // > 50% = white advantage (white bar grows from bottom)
  // < 50% = black advantage (black bar grows from top)

  const whiteHeight = 50 + percent; // 0-100%
  const blackHeight = 50 - percent; // 0-100%

  const graphBlack = document.getElementById('graphBlack');
  const graphWhite = document.getElementById('graphWhite');
  const graphDraw = document.getElementById('graphDraw');

  graphBlack.style.height = blackHeight + '%';
  graphWhite.style.height = whiteHeight + '%';
  graphDraw.style.height = '0%';

  // Update evaluation text
  const evalText = (evalCp / 100).toFixed(1);
  if (evalCp > 0) {
    document.getElementById('whitePercent').textContent = '+' + evalText;
    document.getElementById('blackPercent').textContent = '';
  } else if (evalCp < 0) {
    document.getElementById('blackPercent').textContent = evalText;
    document.getElementById('whitePercent').textContent = '';
  } else {
    document.getElementById('whitePercent').textContent = '0.0';
    document.getElementById('blackPercent').textContent = '';
  }
  document.getElementById('drawPercent').textContent = '';
}

function updateWinrateGraph(whiteWins, blackWins, draws) {
  const total = whiteWins + blackWins + draws;

  if (total === 0) {
    // Reset graph to center
    updateEvaluationGraph(0);
    return;
  }

  const blackPercent = (blackWins / total) * 100;
  const drawPercent = (draws / total) * 100;
  const whitePercent = (whiteWins / total) * 100;

  // Update bar heights and positions
  const graphBlack = document.getElementById('graphBlack');
  const graphDraw = document.getElementById('graphDraw');
  const graphWhite = document.getElementById('graphWhite');

  graphBlack.style.height = blackPercent + '%';
  graphDraw.style.height = drawPercent + '%';
  graphDraw.style.top = blackPercent + '%';
  graphWhite.style.height = whitePercent + '%';

  // Update percentages text
  document.getElementById('blackPercent').textContent = blackPercent >= 10 ? blackPercent.toFixed(0) + '%' : '';
  document.getElementById('drawPercent').textContent = drawPercent >= 5 ? drawPercent.toFixed(0) + '%' : '';
  document.getElementById('whitePercent').textContent = whitePercent >= 10 ? whitePercent.toFixed(0) + '%' : '';
}

// Global functions for HTML buttons
window.newGame = function() {
  if (game) game.delete();
  currentGameMoves = []; // Reset move record
  currentEvaluation = 0; // Reset evaluation
  updateEvaluationGraph(0); // Reset graph to center
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
