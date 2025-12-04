// NoaChess - Simple chess UI using Fairy-Stockfish and Chessground
const Chessground = require('chessgroundx').Chessground;
import Module from 'ffish-es6';

let ffish;
let board;
let game;
let chessground;

// Current variant configuration
let currentVariant = 'noachess';
const variantConfigs = {
  noachess: {
    name: 'NoaChess',
    file: './noachess.ini',
    dimensions: { width: 6, height: 6 },
    startFen: 'lbqknr/pppppp/6/6/PPPPPP/LBQKNR w - - 0 1'
  },
  khasar: {
    name: 'Khasar Chess',
    file: './khasar.ini',
    dimensions: { width: 9, height: 9 },
    startFen: 'lhaykyahl/ppppppppp/9/9/9/9/PPPPPPPPP/9/LHAYKYAHL w - - 0 1'
  }
};

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

// Captured pieces tracking
let capturedByWhite = []; // Black pieces captured by white
let capturedByBlack = []; // White pieces captured by white
let boardOrientation = 'white'; // Track board orientation

// Position history for threefold repetition detection
let positionHistory = [];

// Game ID for race condition protection
let currentGameId = 0;

// Current Stockfish listener (to remove before adding new one)
let currentSearchListener = null;

// Search sequence number to prevent stale results
let searchSequence = 0;

// Flag to prevent saving the same game multiple times
let gameSaved = false;

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
        stockfishEngine.postMessage(`setoption name UCI_Variant value ${currentVariant}`);
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

// Load variant configuration
async function loadVariant(variantName) {
  currentVariant = variantName;
  const config = variantConfigs[variantName];

  console.log(`Loading ${config.name}...`);

  try {
    const response = await fetch(config.file);
    const ini = await response.text();
    variantsIni = ini;

    console.log(`${config.name} INI content:`, ini);
    ffish.loadVariantConfig(ini);
    console.log(`${config.name} variant loaded!`);
    console.log('Available variants:', ffish.variants());

    // Reinitialize Stockfish with new variant
    if (stockfishEngine && stockfishReady) {
      stockfishReady = false;
      stockfishEngine.postMessage(`setoption name UCI_Variant value ${currentVariant}`);
      stockfishEngine.postMessage('isready');
    }

    // Initialize/reinitialize game
    initGame();
  } catch (error) {
    console.error(`Failed to load ${config.name} variant:`, error);
    updateStatus('Error loading game. Please refresh.');
  }
}

// Initialize Fairy-Stockfish
new Module().then((loadedModule) => {
  ffish = loadedModule;
  console.log('ffish-es6 loaded!');

  // Load saved or default variant
  const savedVariant = localStorage.getItem('selectedVariant') || currentVariant;
  loadVariant(savedVariant).then(() => {
    // Initialize Stockfish engine
    initStockfishEngine();
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
  // Increment game ID to invalidate previous game's callbacks
  currentGameId++;
  console.log('Starting game ID:', currentGameId);

  // Clean up any existing Stockfish listener
  if (currentSearchListener && stockfishEngine) {
    stockfishEngine.removeMessageListener(currentSearchListener);
    currentSearchListener = null;
    stockfishEngine.postMessage('stop');
  }

  // Get current variant configuration
  const config = variantConfigs[currentVariant];

  // Create new game
  game = new ffish.Board(currentVariant, config.startFen);
  console.log('Game initialized with variant:', game.variant());
  console.log('Legal moves from start:', game.legalMoves());

  // Initialize position history and record initial position
  positionHistory = [];
  gameSaved = false; // Reset game saved flag
  recordPosition();

  // Reset captured pieces
  capturedByWhite = [];
  capturedByBlack = [];
  updateCapturedPiecesDisplay();

  // Initialize or update chessground
  const boardElement = document.getElementById('board');

  // Update variant class on wrapper
  const wrapper = boardElement.querySelector('.cg-wrap') || boardElement;
  wrapper.className = wrapper.className.replace(/variant-\w+/g, '').trim();
  wrapper.classList.add(`variant-${currentVariant}`);

  if (chessground) {
    // Update existing board
    chessground.set({
      fen: game.fen(),
      movable: {
        free: false,
        color: getMovableColor(),
        dests: getLegalMoves()
      },
      dimensions: config.dimensions
    });
  } else {
    // Create new board
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
      dimensions: config.dimensions
    });

    // Add variant class to wrapper after creation
    const wrapperAfter = boardElement.querySelector('.cg-wrap');
    if (wrapperAfter) {
      wrapperAfter.classList.add(`variant-${currentVariant}`);
    }

    // Add event listeners for checkboxes (only once)
    document.getElementById('playWhite').addEventListener('change', updateMovableColor);
    document.getElementById('playBlack').addEventListener('change', updateMovableColor);
  }

  updateStatus('White to move');
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
    const fenBefore = game.fen();
    game.push(actualMove);
    const fenAfter = game.fen();
    currentGameMoves.push(actualMove); // Record move

    // Detect and record capture
    const capturedPiece = detectCapture(fenBefore, fenAfter);
    recordCapture(capturedPiece);

    // Record position for repetition detection
    recordPosition();

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
  // Check for game over including repetition
  const isRepetitionDraw = checkThreefoldRepetition();

  if (game.isGameOver() || isRepetitionDraw) {
    updateGameStatus();
    return;
  }

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
    let moveProcessed = false; // Flag to prevent duplicate processing
    const gameIdAtStart = currentGameId; // Capture game ID for race condition check
    searchSequence++; // Increment search sequence
    const searchSeqAtStart = searchSequence;
    console.log(`Starting search #${searchSeqAtStart} for game #${gameIdAtStart}`);

    // Remove previous listener if exists (prevent multiple active listeners)
    if (currentSearchListener) {
      console.log('Removing previous search listener');
      stockfishEngine.removeMessageListener(currentSearchListener);
      currentSearchListener = null;
    }

    // Temporary listener for this search
    let finalEvaluation = 0;

    const searchListener = (line) => {
      // Ignore results from previous games/searches or if already processed
      if (gameIdAtStart !== currentGameId || searchSeqAtStart !== searchSequence || moveProcessed) {
        if (line.startsWith('bestmove')) {
          console.log(`Ignoring stale bestmove: search #${searchSeqAtStart} (current: #${searchSequence}), game #${gameIdAtStart} (current: #${currentGameId}), processed: ${moveProcessed}`);
        }
        stockfishEngine.removeMessageListener(searchListener);
        if (currentSearchListener === searchListener) {
          currentSearchListener = null;
        }
        return;
      }

      // Parse evaluation from info lines - store final depth only
      if (line.startsWith('info') && line.includes('score')) {
        const depthMatch = line.match(/depth (\d+)/);
        const currentDepth = depthMatch ? parseInt(depthMatch[1]) : 0;

        // Only store evaluation at final depth
        if (currentDepth >= depth) {
          const cpMatch = line.match(/score cp (-?\d+)/);
          const mateMatch = line.match(/score mate (-?\d+)/);

          if (cpMatch) {
            finalEvaluation = parseInt(cpMatch[1]);
          } else if (mateMatch) {
            const mateIn = parseInt(mateMatch[1]);
            finalEvaluation = mateIn > 0 ? 3000 : -3000;
          }
        }
      }

      if (line.startsWith('bestmove')) {
        // Immediately mark as processed and remove listener to prevent duplicates
        moveProcessed = true;
        stockfishEngine.removeMessageListener(searchListener);
        if (currentSearchListener === searchListener) {
          currentSearchListener = null;
        }

        // Double check game ID before processing
        if (gameIdAtStart !== currentGameId) {
          return;
        }

        const parts = line.split(' ');
        bestMove = parts[1];
        console.log(`Processing bestmove ${bestMove} from search #${searchSeqAtStart}`);

        if (bestMove && bestMove !== '(none)') {
          const fenBefore = game.fen();
          game.push(bestMove);
          const fenAfter = game.fen();
          currentGameMoves.push(bestMove); // Record move

          // Detect and record capture
          const capturedPiece = detectCapture(fenBefore, fenAfter);
          recordCapture(capturedPiece);

          // Record position for repetition detection
          recordPosition();

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
      }
    };

    // Store and add the listener
    currentSearchListener = searchListener;
    stockfishEngine.addMessageListener(searchListener);

    // Stop any previous search before starting new one
    stockfishEngine.postMessage('stop');

    // Send search command
    stockfishEngine.postMessage('position fen ' + game.fen());
    stockfishEngine.postMessage('go depth ' + depth);

    // Fallback timeout
    setTimeout(() => {
      if (!bestMove && !moveProcessed) {
        console.log('Stockfish timeout, using fallback');
        stockfishEngine.removeMessageListener(searchListener);
        if (currentSearchListener === searchListener) {
          currentSearchListener = null;
        }
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

    const fenBefore = game.fen();
    game.push(selectedMove);
    const fenAfter = game.fen();
    currentGameMoves.push(selectedMove); // Record move

    // Detect and record capture
    const capturedPiece = detectCapture(fenBefore, fenAfter);
    recordCapture(capturedPiece);

    // Record position for repetition detection
    recordPosition();

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
      const fenBefore = game.fen();
      game.push(bestMove);
      const fenAfter = game.fen();
      currentGameMoves.push(bestMove); // Record move

      // Detect and record capture
      const capturedPiece = detectCapture(fenBefore, fenAfter);
      recordCapture(capturedPiece);

      // Record position for repetition detection
      recordPosition();

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
  // Adjusted for new piece movements (close-combat focused)
  const pieceValues = {
    'p': 100, 'n': 320, 'b': 330, 'r': 280, 'q': 450, 'l': 240, 'g': 150, 'k': 0
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

// Get position key from FEN (board + turn + castling + en passant)
function getPositionKey(fen) {
  const parts = fen.split(' ');
  // Include board, turn, castling rights, en passant square
  return parts.slice(0, 4).join(' ');
}

// Check for threefold repetition
function checkThreefoldRepetition() {
  const currentPosition = getPositionKey(game.fen());
  let count = 0;
  for (const pos of positionHistory) {
    if (pos === currentPosition) {
      count++;
      if (count >= 3) return true;
    }
  }
  return false;
}

// Record current position to history
function recordPosition() {
  const posKey = getPositionKey(game.fen());
  // Prevent duplicate consecutive recordings (race condition protection)
  if (positionHistory.length > 0 && positionHistory[positionHistory.length - 1] === posKey) {
    console.log('Skipping duplicate position recording');
    return;
  }
  positionHistory.push(posKey);
  console.log('Position history length:', positionHistory.length);
}

function updateGameStatus() {
  // Check for threefold repetition manually
  const isRepetitionDraw = checkThreefoldRepetition();

  if (game.isGameOver() || isRepetitionDraw) {
    const result = game.result();
    let winner = 'draw';
    if (isRepetitionDraw) {
      updateStatus('Draw (3-fold repetition)');
      winner = 'draw';
    } else if (result.includes('1-0')) {
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

    // Save game record (only once per game)
    if (!gameSaved) {
      gameSaved = true;
      saveGameRecord(winner);
    }

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

  // Start first game
  newGame();
  setTimeout(makeAIMove, 500);
}

window.stopAutoPlay = function() {
  autoPlayMode = false;
  updateAutoPlayUI();
  updateStatus(`Auto-play stopped. ${autoPlayCount} games completed.`);
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
}

function requestEvaluation() {
  if (!stockfishReady || !stockfishEngine) return;

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
  positionHistory = []; // Reset position history
  resetCapturedPieces(); // Reset captured pieces
  initGame();
}

window.flipBoard = function() {
  chessground.toggleOrientation();
  boardOrientation = boardOrientation === 'white' ? 'black' : 'white';
  updateCapturedPiecesDisplay();
}

// Get pieces from FEN string
function getPiecesFromFen(fen) {
  const pieces = {};
  const pieceTypes = ['p', 'n', 'b', 'r', 'q', 'l', 'g', 'h', 'a', 'y', 'k', 'P', 'N', 'B', 'R', 'Q', 'L', 'G', 'H', 'A', 'Y', 'K'];

  pieceTypes.forEach(p => pieces[p] = 0);

  const fenBoard = fen.split(' ')[0];
  for (const char of fenBoard) {
    if (pieceTypes.includes(char)) {
      pieces[char]++;
    }
  }
  return pieces;
}

// Detect captured piece by comparing FEN before and after move
function detectCapture(fenBefore, fenAfter) {
  const piecesBefore = getPiecesFromFen(fenBefore);
  const piecesAfter = getPiecesFromFen(fenAfter);

  // Check for missing pieces
  const allPieces = ['p', 'n', 'b', 'r', 'q', 'l', 'g', 'h', 'a', 'y', 'P', 'N', 'B', 'R', 'Q', 'L', 'G', 'H', 'A', 'Y'];

  for (const piece of allPieces) {
    if (piecesAfter[piece] < piecesBefore[piece]) {
      return piece;
    }
  }
  return null;
}

// Record a capture
function recordCapture(capturedPiece) {
  if (!capturedPiece) return;

  // Lowercase = black piece (captured by white)
  // Uppercase = white piece (captured by black)
  if (capturedPiece === capturedPiece.toLowerCase()) {
    capturedByWhite.push(capturedPiece);
  } else {
    capturedByBlack.push(capturedPiece.toLowerCase());
  }

  updateCapturedPiecesDisplay();
}

// Update captured pieces display
function updateCapturedPiecesDisplay() {
  const topContainer = document.getElementById('capturedTop');
  const bottomContainer = document.getElementById('capturedBottom');

  if (!topContainer || !bottomContainer) return;

  // Sort pieces by value for display
  const pieceOrder = { 'q': 0, 'r': 1, 'b': 2, 'l': 3, 'n': 4, 'g': 5, 'p': 6 };

  const sortPieces = (arr) => [...arr].sort((a, b) => pieceOrder[a] - pieceOrder[b]);

  const whiteCapturesSorted = sortPieces(capturedByWhite);
  const blackCapturesSorted = sortPieces(capturedByBlack);

  // Generate HTML for piece display
  const generatePieceHtml = (pieces, color) => {
    return pieces.map(p => `<span class="captured-piece ${color}">${getPieceSymbol(p, color)}</span>`).join('');
  };

  // When white is at bottom: white's captures (black pieces) at bottom, black's captures (white pieces) at top
  // When black is at bottom: swap positions
  if (boardOrientation === 'white') {
    topContainer.innerHTML = generatePieceHtml(blackCapturesSorted, 'white');
    bottomContainer.innerHTML = generatePieceHtml(whiteCapturesSorted, 'black');
  } else {
    topContainer.innerHTML = generatePieceHtml(whiteCapturesSorted, 'black');
    bottomContainer.innerHTML = generatePieceHtml(blackCapturesSorted, 'white');
  }
}

// Get chess piece unicode symbol
function getPieceSymbol(piece, color) {
  const symbols = {
    'k': color === 'white' ? '♔' : '♚',
    'q': color === 'white' ? '♕' : '♛',
    'r': color === 'white' ? '♖' : '♜',
    'b': color === 'white' ? '♗' : '♝',
    'n': color === 'white' ? '♘' : '♞',
    'p': color === 'white' ? '♙' : '♟',
    'l': color === 'white' ? '⚔' : '⚔',  // Lancer/Leaper uses dagger symbol
    'g': color === 'white' ? '★' : '★',  // General uses star symbol
    'h': color === 'white' ? '🐎' : '🐴', // Keshik (Wildebeest) - horse emoji
    'a': color === 'white' ? '🏹' : '🏹', // Archer - bow and arrow emoji
    'y': color === 'white' ? '⛺' : '⛺'  // Yurt - tent emoji
  };
  return symbols[piece] || piece;
}

// Reset captured pieces
function resetCapturedPieces() {
  capturedByWhite = [];
  capturedByBlack = [];
  updateCapturedPiecesDisplay();
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

// Variant selector event listener
document.addEventListener('DOMContentLoaded', () => {
  const variantSelect = document.getElementById('variantSelect');
  if (variantSelect) {
    // Restore saved variant selection
    const savedVariant = localStorage.getItem('selectedVariant');
    if (savedVariant && savedVariant !== currentVariant) {
      variantSelect.value = savedVariant;
      currentVariant = savedVariant;
    }

    variantSelect.addEventListener('change', (e) => {
      const selectedVariant = e.target.value;
      console.log('Variant changed to:', selectedVariant);

      // Save selection and reload page
      localStorage.setItem('selectedVariant', selectedVariant);
      location.reload();
    });
  }
});
