// UCI Wrapper for Fairy-Stockfish
// This worker loads stockfish.js and provides a simple UCI interface

importScripts('stockfish.js');

let engine = null;
let ready = false;

// Initialize Stockfish
Stockfish().then(sf => {
  engine = sf;

  // Forward all engine messages to main thread
  // Use addMessageListener (Fairy-Stockfish WASM API)
  engine.addMessageListener((line) => {
    self.postMessage(line);
  });

  ready = true;
  console.log('UCI Wrapper: Stockfish loaded in worker');
}).catch(err => {
  self.postMessage('error: Failed to load Stockfish: ' + err.message);
});

// Handle messages from main thread
self.onmessage = function(e) {
  if (!ready) {
    console.log('UCI Wrapper: Engine not ready yet, queueing command');
    // Wait for engine to be ready
    const checkReady = setInterval(() => {
      if (ready && engine) {
        clearInterval(checkReady);
        engine.postMessage(e.data);
      }
    }, 100);
  } else if (engine) {
    // Forward command to engine
    engine.postMessage(e.data);
  }
};
