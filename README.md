# NoaChess

A 6×6 chess variant with unique piece movements, powered by Fairy-Stockfish NNUE AI engine.

## Play Online

🎮 **Live Demo**: https://cbf09ea0.noachess.pages.dev/

> **Note**: This project requires Cloudflare Pages or Netlify for proper deployment due to SharedArrayBuffer security requirements. Vercel's static hosting does not support the necessary COOP/COEP headers.

## About

NoaChess features:
- **6×6 board** with brown checkerboard pattern
- **Unique pieces**: Leaper, modified Bishop/Rook/Queen, standard Knight and King
- **Pawn promotion**: Pawns automatically promote to Generals at the far rank
- **Starting position**: `lbqknr/pppppp/6/6/PPPPPP/LBQKNR w - - 0 1`
- **Strong AI**: Fairy-Stockfish NNUE with depth-12 search (adjustable 1-20)

## Piece Movements

| Piece | Movement | Betza Notation |
|-------|----------|----------------|
| **Pawn (P)** | Moves forward 1, sideways 1; captures diagonally forward | `fsmWfcF` |
| **Bishop (B)** | Moves 1 diagonal OR jumps 2 orthogonal | `FD` |
| **Rook (R)** | Moves up to 2 squares orthogonally | `mR2cR2` |
| **Queen (Q)** | Knight movement + 1 diagonal (12 squares total) | `NF` |
| **Leaper (L)** | Moves 1 square (8-dir); captures 2 square jump (Alibaba) | `mWmFcAcD` |
| **Knight (N)** | Standard L-shape movement | `N` |
| **King (K)** | Standard king (royal piece) | `K` |
| **General (G)** | Moves 1 square any direction (promoted pawn, non-royal) | `WF` |

## Tech Stack

- **UI**: [Chessgroundx](https://github.com/gbtami/chessgroundx) - Interactive chess board
- **Game Logic**: [ffish-es6](https://github.com/gbtami/ffish) - Fairy-Stockfish WebAssembly (board logic)
- **AI Engine**: [fairy-stockfish-nnue.wasm](https://github.com/ianfab/fairy-stockfish.wasm) - UCI chess engine with NNUE evaluation
- **Build**: Browserify + esmify
- **Hosting**: Cloudflare Pages (with COOP/COEP/CORP headers for SharedArrayBuffer)

## Local Development

### Prerequisites
- Node.js 14+ and npm

### Setup
```bash
# Clone the repository
git clone https://github.com/Wo1g1/NoaChess.git
cd NoaChess

# Install dependencies
npm install

# Build the project
npm run build

# Serve locally (requires a local server)
npm run serve
# or
npx serve public -p 5000
```

Visit `http://localhost:5000`

> **Important**: Local development requires proper headers for SharedArrayBuffer. The `serve` package handles this automatically, but if using a different server, ensure it sets COOP/COEP headers.

## Deployment

### Cloudflare Pages (Recommended)

Cloudflare Pages is the recommended hosting platform because it properly supports the `_headers` file required for SharedArrayBuffer.

1. **Connect to Cloudflare Pages**:
   - Visit https://pages.cloudflare.com
   - Click "Create a project" → "Connect to Git"
   - Select your NoaChess repository

2. **Build Settings**:
   ```
   Framework preset: None
   Build command: npm run build
   Build output directory: public
   Root directory: (leave empty)
   ```

3. **Deploy**:
   - Click "Save and Deploy"
   - Wait 1-2 minutes for build to complete
   - Your site will be live at `https://[random-id].noachess.pages.dev`

4. **Custom Domain** (optional):
   - Go to project settings → Custom domains
   - Add your domain and configure DNS

### Netlify (Alternative)

Netlify also supports `_headers` files:

1. Visit https://app.netlify.com
2. "Add new site" → "Import an existing project"
3. Select NoaChess repository
4. Build settings:
   ```
   Build command: npm run build
   Publish directory: public
   ```
5. Deploy

### Why Not Vercel?

Vercel's static hosting does not apply `vercel.json` headers to static files, causing SharedArrayBuffer to be unavailable. This breaks Fairy-Stockfish's pthread-based architecture.

**Workaround**: Convert to Next.js or use Edge Functions (adds complexity).

## Files Structure

```
NoaChess/
├── public/
│   ├── index.html           # Main HTML
│   ├── bundle.js            # Compiled JS (generated)
│   ├── stockfish.js         # Fairy-Stockfish WASM loader
│   ├── stockfish.wasm       # Fairy-Stockfish WASM binary
│   ├── stockfish.worker.js  # pthread worker
│   ├── ffish.wasm           # ffish-es6 WASM binary
│   ├── noachess.ini         # Variant configuration
│   ├── _headers             # Cloudflare/Netlify headers
│   └── assets/              # CSS and piece SVGs
├── src/
│   └── main.js              # Main game logic
├── package.json
├── vercel.json              # Vercel config (does not work for static sites)
└── README.md
```

## Configuration

### Variant Rules (`public/noachess.ini`)

The game rules are defined in the Fairy-Stockfish INI format:
- Board size: 6×6
- Custom piece movements via Betza notation
- Promotion: Pawns → Generals at rank 6 (white) / rank 1 (black)
- No castling, no en passant

### AI Settings

Adjustable in the UI:
- **Search Depth**: 1-20 (default: 12)
  - Lower = faster but weaker (4-6 recommended for fast play)
  - Higher = stronger but slower (12-16 recommended for strong play)

## Security Headers

The `_headers` file in the `public/` directory sets required security headers:

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: cross-origin
```

These headers enable `SharedArrayBuffer`, which is required for Fairy-Stockfish's multi-threaded engine.

## Troubleshooting

### "SharedArrayBuffer is not defined" Error

**Cause**: COOP/COEP headers not applied

**Solution**:
1. Verify headers in browser DevTools (Network tab → Response Headers)
2. Ensure hosting platform supports `_headers` file
3. Use Cloudflare Pages or Netlify (not Vercel static)

### AI Not Working / Falls Back to Random Moves

**Cause**: Fairy-Stockfish failed to initialize

**Solution**:
1. Check browser console for errors
2. Verify `stockfish.js`, `stockfish.wasm`, `stockfish.worker.js` are loaded
3. Confirm SharedArrayBuffer is available: `typeof SharedArrayBuffer !== 'undefined'`

### Pawn Promotion Not Working

**Cause**: Move notation mismatch

**Solution**: Check console logs for "Found promotion move" message. The code automatically detects promotion moves (e.g., `e5e6g`).

## Credits

- **Fairy-Stockfish**: https://github.com/fairy-stockfish/Fairy-Stockfish
- **ffish-es6**: https://github.com/gbtami/ffish
- **Chessgroundx**: https://github.com/gbtami/chessgroundx
- **Inspired by**: [Fairyground](https://github.com/ianfab/fairyground) and [pychess-variants](https://github.com/gbtami/pychess-variants)

## License

GPL-3.0 - See [LICENSE](LICENSE) file for details

This project uses Fairy-Stockfish and related libraries, which are licensed under GPL-3.0.
