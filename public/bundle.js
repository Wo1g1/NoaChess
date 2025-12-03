(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.anim = void 0;
exports.render = render;
var util = _interopRequireWildcard(require("./util.js"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
const anim = (mutation, state) => state.animation.enabled ? animate(mutation, state) : render(mutation, state);
exports.anim = anim;
function render(mutation, state) {
  const result = mutation(state);
  state.dom.redraw();
  return result;
}
const makePiece = (key, piece) => ({
  key: key,
  pos: util.key2pos(key),
  piece: piece
});
const closer = (piece, pieces) => pieces.sort((p1, p2) => util.distanceSq(piece.pos, p1.pos) - util.distanceSq(piece.pos, p2.pos))[0];
function computePlan(prevPieces, current) {
  const anims = new Map(),
    animedOrigs = [],
    fadings = new Map(),
    missings = [],
    news = [],
    prePieces = new Map();
  let curP, preP, vector;
  for (const [k, p] of prevPieces) {
    prePieces.set(k, makePiece(k, p));
  }
  for (const key of util.allKeys(current.dimensions)) {
    curP = current.boardState.pieces.get(key);
    preP = prePieces.get(key);
    if (curP) {
      if (preP) {
        if (!util.samePiece(curP, preP.piece)) {
          missings.push(preP);
          news.push(makePiece(key, curP));
        }
      } else news.push(makePiece(key, curP));
    } else if (preP) missings.push(preP);
  }
  for (const newP of news) {
    preP = closer(newP, missings.filter(p => util.samePiece(newP.piece, p.piece)));
    if (preP) {
      vector = [preP.pos[0] - newP.pos[0], preP.pos[1] - newP.pos[1]];
      anims.set(newP.key, vector.concat(vector));
      animedOrigs.push(preP.key);
    }
  }
  for (const p of missings) {
    if (!animedOrigs.includes(p.key)) fadings.set(p.key, p.piece);
  }
  return {
    anims: anims,
    fadings: fadings
  };
}
function step(state, now) {
  const cur = state.animation.current;
  if (cur === undefined) {
    // animation was canceled :(
    if (!state.dom.destroyed) state.dom.redrawNow();
    return;
  }
  const rest = 1 - (now - cur.start) * cur.frequency;
  if (rest <= 0) {
    state.animation.current = undefined;
    state.dom.redrawNow();
  } else {
    const ease = easing(rest);
    for (const cfg of cur.plan.anims.values()) {
      cfg[2] = cfg[0] * ease;
      cfg[3] = cfg[1] * ease;
    }
    state.dom.redrawNow(true); // optimisation: don't render SVG changes during animations
    requestAnimationFrame((now = performance.now()) => step(state, now));
  }
}
function animate(mutation, state) {
  // clone state before mutating it
  const prevPieces = new Map(state.boardState.pieces);
  const result = mutation(state);
  const plan = computePlan(prevPieces, state);
  if (plan.anims.size || plan.fadings.size) {
    const alreadyRunning = state.animation.current && state.animation.current.start;
    state.animation.current = {
      start: performance.now(),
      frequency: 1 / state.animation.duration,
      plan: plan
    };
    if (!alreadyRunning) step(state, performance.now());
  } else {
    // don't animate, just render right away
    state.dom.redraw();
  }
  return result;
}
// https://gist.github.com/gre/1650294
const easing = t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

},{"./util.js":20}],2:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.start = start;
var board = _interopRequireWildcard(require("./board.js"));
var _fen = require("./fen.js");
var _config = require("./config.js");
var _anim = require("./anim.js");
var _drag = require("./drag.js");
var _explosion = require("./explosion.js");
var _util = require("./util.js");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
// see API types and documentations in dts/api.d.ts
function start(state, redrawAll) {
  function toggleOrientation() {
    board.toggleOrientation(state);
    redrawAll();
  }
  return {
    set(config) {
      if (config.orientation && config.orientation !== state.orientation) toggleOrientation();
      (0, _config.applyAnimation)(state, config);
      (config.fen ? _anim.anim : _anim.render)(state => (0, _config.configure)(state, config), state);
    },
    state,
    getFen: () => (0, _fen.write)(state.boardState, state.dimensions),
    toggleOrientation,
    setPieces(pieces) {
      (0, _anim.anim)(state => board.setPieces(state, pieces), state);
    },
    changePocket(piece, num) {
      var _a;
      if ((_a = state.pocketRoles) === null || _a === void 0 ? void 0 : _a[piece.color].includes(piece.role)) {
        (0, _util.changeNumber)(state.boardState.pockets[piece.color], piece.role, num);
        state.dom.redraw();
      }
    },
    selectSquare(key, force) {
      if (key) (0, _anim.anim)(state => board.select(state, key, force), state);else if (state.selectable.selected) {
        board.unselect(state);
        state.dom.redraw();
      }
    },
    selectPocket(piece) {
      if (piece) (0, _anim.anim)(state => board.select(state, piece), state);else if (state.selectable.selected) {
        board.unselect(state);
        state.dom.redraw();
      }
    },
    unselect() {
      board.unselect(state);
    },
    move(orig, dest) {
      if ((0, _util.isDropOrig)(orig)) board.baseNewPiece(state, {
        role: (0, _util.roleOf)(orig),
        color: state.turnColor
      }, dest, true);else (0, _anim.anim)(state => board.baseMove(state, orig, dest), state);
    },
    newPiece(piece, key, fromPocket) {
      (0, _anim.anim)(state => board.baseNewPiece(state, piece, key, fromPocket), state);
    },
    playPremove() {
      if (state.premovable.current) {
        if ((0, _anim.anim)(board.playPremove, state)) return true;
        // if the premove couldn't be played, redraw to clear it up
        state.dom.redraw();
      }
      return false;
    },
    cancelPremove() {
      (0, _anim.render)(board.unsetPremove, state);
    },
    cancelMove() {
      (0, _anim.render)(state => {
        board.cancelMove(state);
        (0, _drag.cancel)(state);
      }, state);
    },
    stop() {
      (0, _anim.render)(state => {
        board.stop(state);
        (0, _drag.cancel)(state);
      }, state);
    },
    explode(keys) {
      (0, _explosion.explosion)(state, keys);
    },
    setAutoShapes(shapes) {
      (0, _anim.render)(state => state.drawable.autoShapes = shapes, state);
    },
    setShapes(shapes) {
      (0, _anim.render)(state => state.drawable.shapes = shapes, state);
    },
    getKeyAtDomPos(pos) {
      return board.getKeyAtDomPos(pos, board.whitePov(state), state.dom.bounds(), state.dimensions);
    },
    redrawAll,
    dragNewPiece(piece, fromPocket, event, force) {
      (0, _drag.dragNewPiece)(state, piece, fromPocket, event, undefined, force);
    },
    destroy() {
      board.stop(state);
      state.dom.unbind && state.dom.unbind();
      state.dom.destroyed = true;
    }
  };
}

},{"./anim.js":1,"./board.js":4,"./config.js":6,"./drag.js":7,"./explosion.js":10,"./fen.js":11,"./util.js":20}],3:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.render = render;
exports.renderResized = renderResized;
var _util = require("./util.js");
var _board = require("./board.js");
var _sync = require("./sync.js");
function render(state, autoPieceEl) {
  const autoPieces = state.drawable.autoShapes.filter(autoShape => autoShape.piece);
  const autoPieceShapes = autoPieces.map(s => {
    return {
      shape: s,
      hash: hash(s),
      current: false
    };
  });
  (0, _sync.syncShapes)(autoPieceShapes, autoPieceEl, shape => renderShape(state, shape, state.dom.bounds()));
}
function renderResized(state) {
  var _a;
  const asWhite = (0, _board.whitePov)(state),
    posToTranslate = (0, _util.posToTranslate)(state.dom.bounds(), state.dimensions);
  let el = (_a = state.dom.elements.autoPieces) === null || _a === void 0 ? void 0 : _a.firstChild;
  while (el) {
    (0, _util.translateAndScale)(el, posToTranslate((0, _util.key2pos)(el.cgKey), asWhite), el.cgScale);
    el = el.nextSibling;
  }
}
function renderShape(state, {
  shape,
  hash
}, bounds) {
  if (shape.piece) {
    const orig = shape.orig;
    const scale = shape.piece.scale;
    const pieceEl = (0, _util.createEl)('piece', (0, _util.pieceClasses)(shape.piece, state.orientation));
    pieceEl.setAttribute('cgHash', hash);
    pieceEl.cgKey = orig;
    pieceEl.cgScale = scale;
    (0, _util.translateAndScale)(pieceEl, (0, _util.posToTranslate)(bounds, state.dimensions)((0, _util.key2pos)(orig), (0, _board.whitePov)(state)), scale);
    return pieceEl;
  } else {
    return (0, _util.createEl)('piece', '');
  }
}
const hash = autoPiece => {
  var _a, _b, _c;
  return [autoPiece.orig, (_a = autoPiece.piece) === null || _a === void 0 ? void 0 : _a.role, (_b = autoPiece.piece) === null || _b === void 0 ? void 0 : _b.color, (_c = autoPiece.piece) === null || _c === void 0 ? void 0 : _c.scale].join(',');
};

},{"./board.js":4,"./sync.js":18,"./util.js":20}],4:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.baseMove = baseMove;
exports.baseNewPiece = baseNewPiece;
exports.callUserFunction = callUserFunction;
exports.canMove = void 0;
exports.cancelMove = cancelMove;
exports.getKeyAtDomPos = getKeyAtDomPos;
exports.getSnappedKeyAtDomPos = getSnappedKeyAtDomPos;
exports.isDraggable = isDraggable;
exports.pieceAvailability = pieceAvailability;
exports.playPremove = playPremove;
exports.reset = reset;
exports.select = select;
exports.setCheck = setCheck;
exports.setDropMode = setDropMode;
exports.setPieces = setPieces;
exports.setSelected = setSelected;
exports.setSelectedKey = setSelectedKey;
exports.stop = stop;
exports.toggleOrientation = toggleOrientation;
exports.unselect = unselect;
exports.unsetPremove = unsetPremove;
exports.userMove = userMove;
exports.whitePov = void 0;
var _util = require("./util.js");
var _premove = require("./premove.js");
function callUserFunction(f, ...args) {
  if (f) setTimeout(() => f(...args), 1);
}
function toggleOrientation(state) {
  state.orientation = (0, _util.opposite)(state.orientation);
  state.animation.current = state.draggable.current = state.selectable.selected = undefined;
}
function reset(state) {
  state.lastMove = undefined;
  unselect(state);
  unsetPremove(state);
}
function setPieces(state, pieces) {
  for (const [key, piece] of pieces) {
    if (piece) state.boardState.pieces.set(key, piece);else state.boardState.pieces.delete(key);
  }
}
function setCheck(state, arg) {
  if (Array.isArray(arg)) state.check = arg;else {
    const color = arg === true ? state.turnColor : arg;
    state.check = [];
    if (color) for (const [k, p] of state.boardState.pieces) if (state.kingRoles.includes(p.role) && p.color === color) state.check.push(k);
  }
}
function setPremove(state, orig, dest, meta) {
  state.premovable.current = [orig, dest];
  callUserFunction(state.premovable.events.set, orig, dest, meta);
}
function unsetPremove(state) {
  if (state.premovable.current) {
    state.premovable.current = undefined;
    callUserFunction(state.premovable.events.unset);
  }
}
function tryAutoCastle(state, orig, dest) {
  if (!state.autoCastle) return false;
  const king = state.boardState.pieces.get(orig);
  if (!king || king.role !== 'k-piece') return false;
  // Because state has no variant info, we assume Capablanca (king moves three squares) for 10x8 boards
  const capa = state.dimensions.width === 10 && state.dimensions.height === 8;
  const origPos = (0, _util.key2pos)(orig);
  const destPos = (0, _util.key2pos)(dest);
  if (origPos[1] !== 0 && origPos[1] !== 7 || origPos[1] !== destPos[1]) return false;
  if (origPos[0] === (capa ? 5 : 4) && !state.boardState.pieces.has(dest)) {
    if (destPos[0] === (capa ? 8 : 6)) dest = (0, _util.pos2key)([capa ? 9 : 7, destPos[1]]);else if (destPos[0] === 2) dest = (0, _util.pos2key)([0, destPos[1]]);
  }
  const rook = state.boardState.pieces.get(dest);
  if (!rook || rook.color !== king.color || rook.role !== 'r-piece') return false;
  state.boardState.pieces.delete(orig);
  state.boardState.pieces.delete(dest);
  if (origPos[0] < destPos[0]) {
    state.boardState.pieces.set((0, _util.pos2key)([capa ? 8 : 6, destPos[1]]), king);
    state.boardState.pieces.set((0, _util.pos2key)([capa ? 7 : 5, destPos[1]]), rook);
  } else {
    state.boardState.pieces.set((0, _util.pos2key)([2, destPos[1]]), king);
    state.boardState.pieces.set((0, _util.pos2key)([3, destPos[1]]), rook);
  }
  return true;
}
function baseMove(state, orig, dest) {
  const origPiece = state.boardState.pieces.get(orig),
    destPiece = state.boardState.pieces.get(dest);
  if (orig === dest || !origPiece) return false;
  const captured = destPiece && destPiece.color !== origPiece.color ? destPiece : undefined;
  if (dest === state.selectable.selected) unselect(state);
  callUserFunction(state.events.move, orig, dest, captured);
  if (!tryAutoCastle(state, orig, dest)) {
    state.boardState.pieces.set(dest, origPiece);
    state.boardState.pieces.delete(orig);
  }
  state.lastMove = [orig, dest];
  state.check = undefined;
  callUserFunction(state.events.change);
  return captured || true;
}
function baseNewPiece(state, piece, dest, fromPocket, force) {
  if (state.boardState.pieces.has(dest)) {
    if (force) state.boardState.pieces.delete(dest);else return false;
  }
  callUserFunction(state.events.dropNewPiece, piece, dest);
  state.boardState.pieces.set(dest, piece);
  if (fromPocket) (0, _util.changeNumber)(state.boardState.pockets[piece.color], piece.role, -1);
  state.lastMove = [(0, _util.dropOrigOf)(piece.role), dest];
  state.check = undefined;
  callUserFunction(state.events.change);
  state.movable.dests = undefined;
  state.turnColor = (0, _util.opposite)(state.turnColor);
  return true;
}
function baseUserMove(state, orig, dest, fromPocket, force) {
  const result = (0, _util.isKey)(orig) ? baseMove(state, orig, dest) : baseNewPiece(state, orig, dest, fromPocket, force);
  if (result) {
    state.movable.dests = undefined;
    state.turnColor = (0, _util.opposite)(state.turnColor);
    state.animation.current = undefined;
  }
  return result;
}
function userMove(state, orig, dest, fromPocket, force) {
  if (canMove(state, orig, dest, fromPocket) || force) {
    const result = baseUserMove(state, orig, dest, fromPocket, force);
    if (result) {
      const holdTime = state.hold.stop();
      unselect(state);
      const metadata = {
        premove: false,
        ctrlKey: state.stats.ctrlKey,
        holdTime
      };
      if (result !== true) metadata.captured = result;
      if ((0, _util.isKey)(orig)) callUserFunction(state.movable.events.after, orig, dest, metadata);else callUserFunction(state.movable.events.afterNewPiece, orig, dest, metadata);
      return true;
    }
  } else if (canPremove(state, orig, dest, fromPocket)) {
    setPremove(state, (0, _util.isKey)(orig) ? orig : (0, _util.dropOrigOf)(orig.role), dest, {
      ctrlKey: state.stats.ctrlKey
    });
    unselect(state);
    return true;
  }
  unselect(state);
  return false;
}
function select(state, selected, force) {
  if ((0, _util.isKey)(selected)) callUserFunction(state.events.select, selected);else callUserFunction(state.events.selectPocket, selected);
  if (state.selectable.selected) {
    if ((0, _util.isSame)(state.selectable.selected, selected) && !state.draggable.enabled) {
      unselect(state);
      state.hold.cancel();
      return;
    } else if ((state.selectable.enabled || force) && (0, _util.isKey)(selected) && state.selectable.selected !== selected) {
      if (userMove(state, state.selectable.selected, selected, !!state.selectable.fromPocket)) {
        state.stats.dragged = false;
        return;
      }
    }
  }
  if ((state.selectable.enabled || state.draggable.enabled) && (isMovable(state, selected, true) || isPremovable(state, selected, true))) {
    setSelected(state, selected, true);
    state.hold.start();
  }
}
function setSelected(state, selected, fromPocket) {
  if ((0, _util.isKey)(selected)) setSelectedKey(state, selected);else setDropMode(state, selected, !!fromPocket);
}
function setSelectedKey(state, key) {
  state.selectable.selected = key;
  state.selectable.fromPocket = false;
  if (isPremovable(state, key, false)) {
    state.premovable.dests = state.premovable.premoveFunc(state.boardState, key, state.premovable.castle);
  } else {
    state.premovable.dests = undefined;
  }
}
function setDropMode(state, piece, fromPocket) {
  state.selectable.selected = piece;
  state.selectable.fromPocket = fromPocket;
  if (isPremovable(state, piece, fromPocket)) {
    state.premovable.dests = state.premovable.predropFunc(state.boardState, piece);
  } else {
    state.premovable.dests = undefined;
  }
}
function unselect(state) {
  state.selectable.selected = undefined;
  state.premovable.dests = undefined;
  state.hold.cancel();
}
function pieceAvailability(state, orig, fromPocket) {
  var _a, _b;
  let piece;
  let available = false;
  if ((0, _util.isKey)(orig)) {
    piece = state.boardState.pieces.get(orig);
    available = !!piece;
  } else {
    piece = orig;
    const num = (_b = (_a = state.boardState.pockets) === null || _a === void 0 ? void 0 : _a[piece.color].get(piece.role)) !== null && _b !== void 0 ? _b : 0;
    available = !fromPocket || num > 0;
  }
  return [piece, available];
}
function isMovable(state, orig, fromPocket) {
  const [piece, available] = pieceAvailability(state, orig, fromPocket);
  return available && (state.movable.color === 'both' || state.movable.color === piece.color && state.turnColor === piece.color);
}
const canMove = (state, orig, dest, fromPocket) => {
  var _a, _b;
  return orig !== dest && isMovable(state, orig, fromPocket) && (state.movable.free || !!((_b = (_a = state.movable.dests) === null || _a === void 0 ? void 0 : _a.get((0, _util.isKey)(orig) ? orig : (0, _util.dropOrigOf)(orig.role))) === null || _b === void 0 ? void 0 : _b.includes(dest)));
};
exports.canMove = canMove;
function isPremovable(state, orig, fromPocket) {
  const [piece, available] = pieceAvailability(state, orig, fromPocket);
  return available && state.premovable.enabled && state.movable.color === piece.color && state.turnColor !== piece.color;
}
const canPremove = (state, orig, dest, fromPocket) => orig !== dest && isPremovable(state, orig, fromPocket) && ((0, _util.isKey)(orig) ? state.premovable.premoveFunc(state.boardState, orig, state.premovable.castle).includes(dest) : state.premovable.predropFunc(state.boardState, orig).includes(dest));
function isDraggable(state, orig, fromPocket) {
  const [piece, available] = pieceAvailability(state, orig, fromPocket);
  return available && state.draggable.enabled && (state.movable.color === 'both' || state.movable.color === piece.color && (state.turnColor === piece.color || state.premovable.enabled));
}
function playPremove(state) {
  const move = state.premovable.current;
  if (!move) return false;
  const orig = (0, _util.isKey)(move[0]) ? move[0] : {
    role: (0, _util.roleOf)(move[0]),
    color: state.turnColor
  };
  const dest = move[1];
  let success = false;
  if (canMove(state, orig, dest, true)) {
    const result = baseUserMove(state, orig, dest, true);
    if (result) {
      const metadata = {
        premove: true
      };
      if (result !== true) metadata.captured = result;
      if ((0, _util.isKey)(orig)) callUserFunction(state.movable.events.after, orig, dest, metadata);else callUserFunction(state.movable.events.afterNewPiece, orig, dest, metadata);
      success = true;
    }
  }
  unsetPremove(state);
  return success;
}
function cancelMove(state) {
  unsetPremove(state);
  unselect(state);
}
function stop(state) {
  state.movable.color = state.movable.dests = state.animation.current = undefined;
  cancelMove(state);
}
function getKeyAtDomPos(pos, asWhite, bounds, bd) {
  let file = Math.floor(bd.width * (pos[0] - bounds.left) / bounds.width);
  if (!asWhite) file = bd.width - 1 - file;
  let rank = bd.height - 1 - Math.floor(bd.height * (pos[1] - bounds.top) / bounds.height);
  if (!asWhite) rank = bd.height - 1 - rank;
  return file >= 0 && file < bd.width && rank >= 0 && rank < bd.height ? (0, _util.pos2key)([file, rank]) : undefined;
}
function getSnappedKeyAtDomPos(orig, pos, asWhite, bounds, bd) {
  const origPos = (0, _util.key2pos)(orig);
  const validSnapPos = (0, _util.allPos)(bd).filter(pos2 => {
    return (0, _premove.queen)(origPos[0], origPos[1], pos2[0], pos2[1]) || (0, _premove.knight)(origPos[0], origPos[1], pos2[0], pos2[1]) ||
    // Only apply this to 9x10 board to avoid interfering with other variants beside Janggi
    bd.width === 9 && bd.height === 10 && (0, _premove.janggiElephant)(origPos[0], origPos[1], pos2[0], pos2[1]);
  });
  const validSnapCenters = validSnapPos.map(pos2 => (0, _util.computeSquareCenter)((0, _util.pos2key)(pos2), asWhite, bounds, bd));
  const validSnapDistances = validSnapCenters.map(pos2 => (0, _util.distanceSq)(pos, pos2));
  const [, closestSnapIndex] = validSnapDistances.reduce((a, b, index) => a[0] < b ? a : [b, index], [validSnapDistances[0], 0]);
  return (0, _util.pos2key)(validSnapPos[closestSnapIndex]);
}
const whitePov = s => s.orientation === 'white';
exports.whitePov = whitePov;

},{"./premove.js":14,"./util.js":20}],5:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Chessground = Chessground;
var _api = require("./api.js");
var _config = require("./config.js");
var _state = require("./state.js");
var _wrap = require("./wrap.js");
var events = _interopRequireWildcard(require("./events.js"));
var _render = require("./render.js");
var autoPieces = _interopRequireWildcard(require("./autoPieces.js"));
var svg = _interopRequireWildcard(require("./svg.js"));
var util = _interopRequireWildcard(require("./util.js"));
var _pocket = require("./pocket.js");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function Chessground(element, config, pocketTop, pocketBottom) {
  const maybeState = (0, _state.defaults)();
  (0, _config.configure)(maybeState, config || {});
  function redrawAll() {
    const prevUnbind = 'dom' in maybeState ? maybeState.dom.unbind : undefined;
    // compute bounds from existing board element if possible
    // this allows non-square boards from CSS to be handled (for 3D)
    const elements = (0, _wrap.renderWrap)(element, maybeState),
      bounds = util.memo(() => elements.board.getBoundingClientRect()),
      redrawNow = skipSvg => {
        (0, _render.render)(state);
        (0, _pocket.renderPockets)(state);
        if (elements.autoPieces) autoPieces.render(state, elements.autoPieces);
        if (!skipSvg && elements.svg) svg.renderSvg(state, elements.svg, elements.customSvg);
      },
      onResize = () => {
        (0, _render.updateBounds)(state);
        (0, _render.renderResized)(state);
        if (elements.autoPieces) autoPieces.renderResized(state);
      };
    if (elements.pocketTop) pocketTop = elements.pocketTop;
    if (elements.pocketBottom) pocketBottom = elements.pocketBottom;
    (0, _pocket.renderPocketsInitial)(maybeState, elements, pocketTop, pocketBottom);
    const state = maybeState;
    state.dom = {
      elements,
      bounds,
      redraw: debounceRedraw(redrawNow),
      redrawNow,
      unbind: prevUnbind
    };
    state.drawable.prevSvgHash = '';
    (0, _render.updateBounds)(state);
    redrawNow(false);
    events.bindBoard(state, onResize);
    if (!prevUnbind) state.dom.unbind = events.bindDocument(state, onResize);
    state.events.insert && state.events.insert(elements);
    return state;
  }
  return (0, _api.start)(redrawAll(), redrawAll);
}
function debounceRedraw(redrawNow) {
  let redrawing = false;
  return () => {
    if (redrawing) return;
    redrawing = true;
    requestAnimationFrame(() => {
      redrawNow();
      redrawing = false;
    });
  };
}

},{"./api.js":2,"./autoPieces.js":3,"./config.js":6,"./events.js":9,"./pocket.js":12,"./render.js":15,"./state.js":16,"./svg.js":17,"./util.js":20,"./wrap.js":21}],6:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.applyAnimation = applyAnimation;
exports.configure = configure;
var _board = require("./board.js");
var _fen = require("./fen.js");
function applyAnimation(state, config) {
  if (config.animation) {
    deepMerge(state.animation, config.animation);
    // no need for such short animations
    if ((state.animation.duration || 0) < 70) state.animation.enabled = false;
  }
}
function configure(state, config) {
  var _a, _b, _c;
  // don't merge destinations and autoShapes. Just override.
  if ((_a = config.movable) === null || _a === void 0 ? void 0 : _a.dests) state.movable.dests = undefined;
  if ((_b = config.drawable) === null || _b === void 0 ? void 0 : _b.autoShapes) state.drawable.autoShapes = [];
  deepMerge(state, config);
  // if a fen was provided, replace the pieces
  if (config.fen) {
    const boardState = (0, _fen.read)(config.fen, state.dimensions);
    // prevent calling cancel() if piece drag is already started from pocket!
    const draggedPiece = state.boardState.pieces.get('a0');
    if (draggedPiece !== undefined) boardState.pieces.set('a0', draggedPiece);
    // set the pocket to empty instead of undefined if pocketRoles exists
    // likewise, set the pocket to undefined if pocketRoles is undefined
    if (state.pocketRoles) boardState.pockets = (_c = boardState.pockets) !== null && _c !== void 0 ? _c : {
      white: new Map(),
      black: new Map()
    };else boardState.pockets = undefined;
    state.boardState = boardState;
    state.drawable.shapes = [];
  }
  // apply config values that could be undefined yet meaningful
  if ('check' in config || 'kingRoles' in config) (0, _board.setCheck)(state, config.check || false);
  if ('lastMove' in config && !config.lastMove) state.lastMove = undefined;
  // in case of ZH drop last move, there's a single square.
  // if the previous last move had two squares,
  // the merge algorithm will incorrectly keep the second square.
  else if (config.lastMove) state.lastMove = config.lastMove;
  // fix move/premove dests
  if (state.selectable.selected) (0, _board.setSelected)(state, state.selectable.selected, state.selectable.fromPocket);
  applyAnimation(state, config);
  if (!state.movable.rookCastle && state.movable.dests) {
    const rank = state.movable.color === 'white' ? '1' : '8',
      kingStartPos = 'e' + rank,
      dests = state.movable.dests.get(kingStartPos),
      king = state.boardState.pieces.get(kingStartPos);
    if (!dests || !king || king.role !== 'k-piece') return;
    state.movable.dests.set(kingStartPos, dests.filter(d => !(d === 'a' + rank && dests.includes('c' + rank)) && !(d === 'h' + rank && dests.includes('g' + rank))));
  }
}
function deepMerge(base, extend) {
  for (const key in extend) {
    if (Object.prototype.hasOwnProperty.call(extend, key)) {
      if (Object.prototype.hasOwnProperty.call(base, key) && isPlainObject(base[key]) && isPlainObject(extend[key])) deepMerge(base[key], extend[key]);else base[key] = extend[key];
    }
  }
}
function isPlainObject(o) {
  if (typeof o !== 'object' || o === null) return false;
  const proto = Object.getPrototypeOf(o);
  return proto === Object.prototype || proto === null;
}

},{"./board.js":4,"./fen.js":11}],7:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.cancel = cancel;
exports.dragNewPiece = dragNewPiece;
exports.end = end;
exports.move = move;
exports.pieceElementByKey = pieceElementByKey;
exports.processDrag = processDrag;
exports.start = start;
var board = _interopRequireWildcard(require("./board.js"));
var util = _interopRequireWildcard(require("./util.js"));
var _draw = require("./draw.js");
var _anim = require("./anim.js");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function start(s, e) {
  if (!e.isTrusted || e.button !== undefined && e.button !== 0) return; // only touch or left click
  if (e.touches && e.touches.length > 1) return; // support one finger touch only
  const bounds = s.dom.bounds(),
    position = util.eventPosition(e),
    orig = board.getKeyAtDomPos(position, board.whitePov(s), bounds, s.dimensions);
  if (!orig) return;
  const piece = s.boardState.pieces.get(orig);
  const previouslySelected = s.selectable.selected;
  if (!previouslySelected && s.drawable.enabled && (s.drawable.eraseOnClick || !piece || piece.color !== s.turnColor)) (0, _draw.clear)(s);
  // Prevent touch scroll and create no corresponding mouse event, if there
  // is an intent to interact with the board.
  if (e.cancelable !== false && (!e.touches || s.blockTouchScroll || piece || previouslySelected || pieceCloseTo(s, position))) e.preventDefault();
  const hadPremove = !!s.premovable.current;
  s.stats.ctrlKey = e.ctrlKey;
  if (s.selectable.selected && board.canMove(s, s.selectable.selected, orig, !!s.selectable.fromPocket)) {
    (0, _anim.anim)(state => board.select(state, orig), s);
  } else {
    board.select(s, orig);
  }
  const stillSelected = s.selectable.selected === orig;
  const element = pieceElementByKey(s, orig);
  if (piece && element && stillSelected && board.isDraggable(s, orig, false)) {
    s.draggable.current = {
      orig,
      piece,
      origPos: position,
      pos: position,
      started: s.draggable.autoDistance && s.stats.dragged,
      element,
      previouslySelected,
      originTarget: e.target,
      keyHasChanged: false
    };
    element.cgDragging = true;
    element.classList.add('dragging');
    // place ghost
    const ghost = s.dom.elements.ghost;
    if (ghost) {
      ghost.className = 'ghost ' + util.pieceClasses(piece, s.orientation);
      util.translate(ghost, util.posToTranslate(bounds, s.dimensions)(util.key2pos(orig), board.whitePov(s)));
      util.setVisible(ghost, true);
    }
    processDrag(s);
  } else {
    if (hadPremove) board.unsetPremove(s);
  }
  s.dom.redraw();
}
function pieceCloseTo(s, pos) {
  const asWhite = board.whitePov(s),
    bounds = s.dom.bounds(),
    radiusSq = Math.pow(bounds.width / s.dimensions.width, 2);
  for (const key of s.boardState.pieces.keys()) {
    const center = util.computeSquareCenter(key, asWhite, bounds, s.dimensions);
    if (util.distanceSq(center, pos) <= radiusSq) return true;
  }
  return false;
}
function dragNewPiece(s, piece, fromPocket, e, previouslySelected, force) {
  s.dom.redraw();
  const position = util.eventPosition(e);
  s.boardState.pieces.set('a0', piece);
  s.draggable.current = {
    orig: 'a0',
    piece,
    origPos: position,
    pos: position,
    started: true,
    element: () => pieceElementByKey(s, 'a0'),
    previouslySelected,
    originTarget: e.target,
    fromPocket: fromPocket,
    force: !!force,
    keyHasChanged: false
  };
  processDrag(s);
}
function processDrag(s) {
  requestAnimationFrame(() => {
    var _a;
    const cur = s.draggable.current;
    if (!cur) return;
    // cancel animations while dragging
    if ((_a = s.animation.current) === null || _a === void 0 ? void 0 : _a.plan.anims.has(cur.orig)) s.animation.current = undefined;
    // if moving piece is gone, cancel
    const origPiece = s.boardState.pieces.get(cur.orig);
    if (!util.samePiece(origPiece, cur.piece)) cancel(s);else {
      if (!cur.started && util.distanceSq(cur.pos, cur.origPos) >= Math.pow(s.draggable.distance, 2)) cur.started = true;
      if (cur.started) {
        // support lazy elements
        if (typeof cur.element === 'function') {
          const found = cur.element();
          if (!found) return;
          found.cgDragging = true;
          found.classList.add('dragging');
          cur.element = found;
        }
        const bounds = s.dom.bounds();
        util.translate(cur.element, [cur.pos[0] - bounds.left - bounds.width / (2 * s.dimensions.width), cur.pos[1] - bounds.top - bounds.height / (2 * s.dimensions.height)]);
        if (cur.orig !== 'a0') cur.keyHasChanged || (cur.keyHasChanged = cur.orig !== board.getKeyAtDomPos(cur.pos, board.whitePov(s), bounds, s.dimensions));
      }
    }
    processDrag(s);
  });
}
function move(s, e) {
  // support one finger touch only
  if (s.draggable.current && (!e.touches || e.touches.length < 2)) {
    s.draggable.current.pos = util.eventPosition(e);
  }
}
function end(s, e) {
  var _a;
  const cur = s.draggable.current;
  if (!cur) return;
  // create no corresponding mouse event
  if (e.type === 'touchend' && e.cancelable !== false) e.preventDefault();
  // comparing with the origin target is an easy way to test that the end event
  // has the same touch origin
  if (e.type === 'touchend' && cur.originTarget !== e.target) {
    s.draggable.current = undefined;
    return;
  }
  board.unsetPremove(s);
  // touchend has no position; so use the last touchmove position instead
  const eventPos = util.eventPosition(e) || cur.pos;
  const dest = board.getKeyAtDomPos(eventPos, board.whitePov(s), s.dom.bounds(), s.dimensions);
  const target = e.target;
  const onPocket = Number((_a = target.getAttribute('data-nb')) !== null && _a !== void 0 ? _a : -1) >= 0;
  const targetPiece = onPocket ? {
    role: target.getAttribute('data-role'),
    color: target.getAttribute('data-color')
  } : undefined;
  if (dest && cur.started && cur.orig !== dest) {
    s.stats.ctrlKey = e.ctrlKey;
    if (board.userMove(s, cur.orig !== 'a0' ? cur.orig : cur.piece, dest, !!cur.fromPocket)) s.stats.dragged = true;
  } else if (s.draggable.deleteOnDropOff && !dest) {
    s.boardState.pieces.delete(cur.orig);
    if (cur.fromPocket) util.changeNumber(s.boardState.pockets[cur.piece.color], cur.piece.role, -1);
    board.callUserFunction(s.events.change);
  }
  if ((cur.previouslySelected && (cur.orig === cur.previouslySelected || util.isSame(cur.piece, cur.previouslySelected)) || cur.keyHasChanged) && (cur.orig === dest || !dest)) board.unselect(s);
  if (cur.orig === 'a0' && (!targetPiece || !util.samePiece(cur.piece, targetPiece))) board.unselect(s);else if (!s.selectable.enabled) board.unselect(s);
  if (cur.orig === 'a0') s.boardState.pieces.delete('a0');
  removeDragElements(s);
  s.draggable.current = undefined;
  s.dom.redraw();
}
function cancel(s) {
  const cur = s.draggable.current;
  if (cur) {
    s.draggable.current = undefined;
    s.boardState.pieces.delete('a0');
    board.unselect(s);
    removeDragElements(s);
    s.dom.redraw();
  }
}
function removeDragElements(s) {
  const e = s.dom.elements;
  if (e.ghost) util.setVisible(e.ghost, false);
}
function pieceElementByKey(s, key) {
  let el = s.dom.elements.board.firstChild;
  while (el) {
    if (el.cgKey === key && el.tagName === 'PIECE') return el;
    el = el.nextSibling;
  }
  return;
}

},{"./anim.js":1,"./board.js":4,"./draw.js":8,"./util.js":20}],8:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.cancel = cancel;
exports.clear = clear;
exports.end = end;
exports.move = move;
exports.processDraw = processDraw;
exports.start = start;
var _board = require("./board.js");
var _util = require("./util.js");
const brushes = ['green', 'red', 'blue', 'yellow'];
function start(state, e) {
  // support one finger touch only
  if (e.touches && e.touches.length > 1) return;
  e.stopPropagation();
  e.preventDefault();
  e.ctrlKey ? (0, _board.unselect)(state) : (0, _board.cancelMove)(state);
  const pos = (0, _util.eventPosition)(e),
    orig = (0, _board.getKeyAtDomPos)(pos, (0, _board.whitePov)(state), state.dom.bounds(), state.dimensions);
  if (!orig) return;
  state.drawable.current = {
    orig,
    pos,
    brush: eventBrush(e),
    snapToValidMove: state.drawable.defaultSnapToValidMove
  };
  processDraw(state);
}
function processDraw(state) {
  requestAnimationFrame(() => {
    const cur = state.drawable.current;
    if (cur) {
      const keyAtDomPos = (0, _board.getKeyAtDomPos)(cur.pos, (0, _board.whitePov)(state), state.dom.bounds(), state.dimensions);
      if (!keyAtDomPos) {
        cur.snapToValidMove = false;
      }
      const mouseSq = cur.snapToValidMove ? (0, _board.getSnappedKeyAtDomPos)(cur.orig, cur.pos, (0, _board.whitePov)(state), state.dom.bounds(), state.dimensions) : keyAtDomPos;
      if (mouseSq !== cur.mouseSq) {
        cur.mouseSq = mouseSq;
        cur.dest = mouseSq !== cur.orig ? mouseSq : undefined;
        state.dom.redrawNow();
      }
      processDraw(state);
    }
  });
}
function move(state, e) {
  if (state.drawable.current) state.drawable.current.pos = (0, _util.eventPosition)(e);
}
function end(state) {
  const cur = state.drawable.current;
  if (cur) {
    if (cur.mouseSq) addShape(state.drawable, cur);
    cancel(state);
  }
}
function cancel(state) {
  if (state.drawable.current) {
    state.drawable.current = undefined;
    state.dom.redraw();
  }
}
function clear(state) {
  if (state.drawable.shapes.length) {
    state.drawable.shapes = [];
    state.dom.redraw();
    onChange(state.drawable);
  }
}
function eventBrush(e) {
  var _a;
  const modA = (e.shiftKey || e.ctrlKey) && (0, _util.isRightButton)(e);
  const modB = e.altKey || e.metaKey || ((_a = e.getModifierState) === null || _a === void 0 ? void 0 : _a.call(e, 'AltGraph'));
  return brushes[(modA ? 1 : 0) + (modB ? 2 : 0)];
}
function addShape(drawable, cur) {
  const sameShape = s => s.orig === cur.orig && s.dest === cur.dest;
  const similar = drawable.shapes.find(sameShape);
  if (similar) drawable.shapes = drawable.shapes.filter(s => !sameShape(s));
  if (!similar || similar.brush !== cur.brush) drawable.shapes.push(cur);
  onChange(drawable);
}
function onChange(drawable) {
  if (drawable.onChange) drawable.onChange(drawable.shapes);
}

},{"./board.js":4,"./util.js":20}],9:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.bindBoard = bindBoard;
exports.bindDocument = bindDocument;
var drag = _interopRequireWildcard(require("./drag.js"));
var draw = _interopRequireWildcard(require("./draw.js"));
var pocket = _interopRequireWildcard(require("./pocket.js"));
var _util = require("./util.js");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function bindBoard(s, onResize) {
  const boardEl = s.dom.elements.board;
  // In case of zooming boards in bughouse, observing s.dom.elements.wrap
  // causes recursive onResize calls, so we will just observe the document.body
  const target = s.dimensionsCssVarsSuffix ? document.body : s.dom.elements.wrap;
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(target);
  if (s.viewOnly) return;
  // Cannot be passive, because we prevent touch scrolling and dragging of
  // selected elements.
  const onStart = startDragOrDraw(s);
  boardEl.addEventListener('touchstart', onStart, {
    passive: false
  });
  boardEl.addEventListener('mousedown', onStart, {
    passive: false
  });
  if (s.disableContextMenu || s.drawable.enabled) {
    boardEl.addEventListener('contextmenu', e => e.preventDefault());
  }
}
// returns the unbind function
function bindDocument(s, onResize) {
  const unbinds = [];
  // Old versions of Edge and Safari do not support ResizeObserver. Send
  // chessground.resize if a user action has changed the bounds of the board.
  if (!('ResizeObserver' in window)) unbinds.push(unbindable(document.body, 'chessground.resize', onResize));
  if (!s.viewOnly) {
    const onmove = dragOrDraw(s, drag.move, draw.move);
    const onend = dragOrDraw(s, drag.end, draw.end);
    for (const ev of ['touchmove', 'mousemove']) unbinds.push(unbindable(document, ev, onmove));
    for (const ev of ['touchend', 'mouseup']) unbinds.push(unbindable(document, ev, onend));
    const onScroll = () => s.dom.bounds.clear();
    unbinds.push(unbindable(document, 'scroll', onScroll, {
      capture: true,
      passive: true
    }));
    unbinds.push(unbindable(window, 'resize', onScroll, {
      passive: true
    }));
    const pocketTop = s.dom.elements.pocketTop;
    const pocketBottom = s.dom.elements.pocketBottom;
    const pocketStart = startDragOrDrawPocket(s);
    [pocketTop, pocketBottom].forEach(el => {
      if (el) {
        for (const ev of ['touchstart', 'mousedown']) unbinds.push(unbindable(el, ev, pocketStart));
        if (s.disableContextMenu || s.drawable.enabled) unbinds.push(unbindable(el, 'contextmenu', e => e.preventDefault()));
      }
    });
  }
  return () => unbinds.forEach(f => f());
}
function unbindable(el, eventName, callback, options) {
  el.addEventListener(eventName, callback, options);
  return () => el.removeEventListener(eventName, callback, options);
}
const startDragOrDraw = s => e => {
  if (s.draggable.current) drag.cancel(s);else if (s.drawable.current) draw.cancel(s);else if (e.shiftKey || (0, _util.isRightButton)(e)) {
    if (s.drawable.enabled) draw.start(s, e);
  } else if (!s.viewOnly) {
    drag.start(s, e);
  }
};
const startDragOrDrawPocket = s => e => {
  if (s.draggable.current) drag.cancel(s);else if (s.drawable.current) draw.cancel(s);else if (e.shiftKey || (0, _util.isRightButton)(e)) {
    if (s.drawable.enabled) draw.start(s, e);
  } else if (!s.viewOnly) {
    pocket.drag(s, e);
  }
};
const dragOrDraw = (s, withDrag, withDraw) => e => {
  if (s.drawable.current) {
    if (s.drawable.enabled) withDraw(s, e);
  } else if (!s.viewOnly) withDrag(s, e);
};

},{"./drag.js":7,"./draw.js":8,"./pocket.js":12,"./util.js":20}],10:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.explosion = explosion;
function explosion(state, keys) {
  state.exploding = {
    stage: 1,
    keys
  };
  state.dom.redraw();
  setTimeout(() => {
    setStage(state, 2);
    setTimeout(() => setStage(state, undefined), 120);
  }, 120);
}
function setStage(state, stage) {
  if (state.exploding) {
    if (stage) state.exploding.stage = stage;else state.exploding = undefined;
    state.dom.redraw();
  }
}

},{}],11:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.initial = void 0;
exports.read = read;
exports.write = write;
exports.writeBoard = writeBoard;
var _util = require("./util.js");
var cg = _interopRequireWildcard(require("./types.js"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
const initial = exports.initial = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
function read(fen, bd) {
  const piecesPart = fen.split(' ')[0];
  const bracketIdx = piecesPart.indexOf('[');
  let boardPart;
  let pocketPart;
  if (bracketIdx > -1) {
    boardPart = piecesPart.slice(0, bracketIdx);
    pocketPart = piecesPart.slice(bracketIdx + 1, piecesPart.indexOf(']'));
  } else {
    const ranks = piecesPart.split('/');
    boardPart = ranks.slice(0, bd.height).join('/');
    // Handle "pocket after an extra slash" format
    pocketPart = ranks.length > bd.height ? ranks[bd.height] : undefined;
  }
  return {
    pieces: readBoard(boardPart),
    pockets: readPockets(pocketPart)
  };
}
function readBoard(fen) {
  if (fen === 'start') fen = initial;
  const pieces = new Map();
  let row = fen.split('/').length - 1;
  let col = 0;
  let promoted = false;
  let mirror = false;
  let num = 0;
  for (const c of fen) {
    switch (c) {
      case ' ':
      case '[':
        return pieces;
      case '/':
        --row;
        if (row < 0) return pieces;
        col = 0;
        num = 0;
        break;
      case '+':
        promoted = true;
        break;
      case '|':
        mirror = true;
        break;
      case '~':
        {
          const piece = pieces.get((0, _util.pos2key)([col - 1, row]));
          if (piece) piece.promoted = true;
          break;
        }
      default:
        {
          const nb = c.charCodeAt(0);
          if (48 <= nb && nb < 58) {
            num = 10 * num + nb - 48;
          } else {
            col += num;
            num = 0;
            const letter = c.toLowerCase();
            const piece = {
              role: (0, _util.roleOf)(letter),
              color: c === letter ? 'black' : 'white'
            };
            if (promoted) {
              piece.role = 'p' + piece.role;
              piece.promoted = true;
              promoted = false;
            }
            if (mirror) {
              piece.mirror = true;
              mirror = false;
            }
            pieces.set((0, _util.pos2key)([col, row]), piece);
            ++col;
          }
        }
    }
  }
  return pieces;
}
function readPockets(pocketStr) {
  if (pocketStr !== undefined) {
    const whitePocket = new Map();
    const blackPocket = new Map();
    for (const p of pocketStr) {
      const role = (0, _util.roleOf)(p);
      if (/[A-Z]/.test(p)) (0, _util.changeNumber)(whitePocket, role, 1);else if (/[a-z]/.test(p)) (0, _util.changeNumber)(blackPocket, role, 1);
    }
    return {
      white: whitePocket,
      black: blackPocket
    };
  } else {
    return undefined;
  }
}
function write(boardState, bd) {
  return writeBoard(boardState.pieces, bd) + writePockets(boardState.pockets);
}
function writeBoard(pieces, bd) {
  return _util.invRanks.slice(-bd.height).map(y => cg.files.slice(0, bd.width).map(x => {
    const piece = pieces.get(x + y);
    if (piece) {
      let p = (0, _util.letterOf)(piece.role, piece.color === 'white');
      if (piece.promoted && p.charAt(0) !== '+') p += '~';
      if (piece.mirror) p = '|' + p;
      return p;
    } else return '1';
  }).join('')).join('/').replace(/1{2,}/g, s => s.length.toString());
}
function writePockets(pockets) {
  if (pockets) return '[' + writePocket(pockets.white, true) + writePocket(pockets.black, false) + ']';else return '';
}
function writePocket(pocket, asWhite) {
  const letters = [];
  for (const [r, n] of pocket.entries()) letters.push((0, _util.letterOf)(r, asWhite).repeat(n));
  return letters.join('');
}

},{"./types.js":19,"./util.js":20}],12:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.drag = drag;
exports.renderPockets = renderPockets;
exports.renderPocketsInitial = renderPocketsInitial;
var util = _interopRequireWildcard(require("./util.js"));
var board = _interopRequireWildcard(require("./board.js"));
var _draw = require("./draw.js");
var _drag = require("./drag.js");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function renderPocketsInitial(state, elements, pocketTop, pocketBottom) {
  if (pocketTop) {
    pocketTop.innerHTML = '';
    elements.pocketTop = pocketTop;
    pocketView(state, elements.pocketTop, 'top');
  }
  if (pocketBottom) {
    pocketBottom.innerHTML = '';
    elements.pocketBottom = pocketBottom;
    pocketView(state, elements.pocketBottom, 'bottom');
  }
}
function pocketView(state, pocketEl, position) {
  if (!state.pocketRoles) return;
  const color = position === 'top' ? util.opposite(state.orientation) : state.orientation;
  const roles = state.pocketRoles[color];
  const pl = String(roles.length);
  const files = String(state.dimensions.width);
  const ranks = String(state.dimensions.height);
  pocketEl.setAttribute('style', `--pocketLength: ${pl}; --files: ${files}; --ranks: ${ranks}`);
  pocketEl.classList.add('pocket', position);
  roles.forEach(role => {
    const pieceName = util.pieceClasses({
      role: role,
      color: color
    }, state.orientation);
    const sq = util.createEl('square');
    const p = util.createEl('piece', pieceName);
    sq.appendChild(p);
    p.setAttribute('data-color', color);
    p.setAttribute('data-role', role);
    renderPiece(state, sq);
    pocketEl.appendChild(sq);
  });
}
/**
 * updates each piece element attributes based on state
 * */
function renderPockets(state) {
  renderPocket(state, state.dom.elements.pocketBottom);
  renderPocket(state, state.dom.elements.pocketTop);
}
function renderPocket(state, pocketEl) {
  if (pocketEl) {
    let sq = pocketEl.firstChild;
    if (sq && sq.firstChild) {
      const color = sq.firstChild.getAttribute('data-color');
      pocketEl.classList.toggle('usable', !state.viewOnly && (state.movable.free || state.movable.color === 'both' || !!color && state.movable.color === color));
      while (sq) {
        renderPiece(state, sq);
        sq = sq.nextSibling;
      }
    }
  }
}
function renderPiece(state, sq) {
  var _a, _b, _c;
  const p = sq.firstChild;
  const role = p.getAttribute('data-role');
  const color = p.getAttribute('data-color');
  p.setAttribute('data-nb', '' + ((_a = state.boardState.pockets[color].get(role)) !== null && _a !== void 0 ? _a : 0));
  const piece = {
    role,
    color
  };
  const selected = state.selectable.selected;
  sq.classList.toggle('selected-square', !!selected && util.isPiece(selected) && state.selectable.fromPocket && util.samePiece(selected, piece));
  const premoveOrig = (_b = state.premovable.current) === null || _b === void 0 ? void 0 : _b[0];
  sq.classList.toggle('premove', !!premoveOrig && util.isDropOrig(premoveOrig) && util.roleOf(premoveOrig) === role && state.turnColor !== color);
  sq.classList.toggle('last-move', state.highlight.lastMove && !!((_c = state.lastMove) === null || _c === void 0 ? void 0 : _c.includes(util.dropOrigOf(role))) && state.turnColor !== color);
}
function drag(s, e) {
  if (!e.isTrusted || e.button !== undefined && e.button !== 0) return; // only touch or left click
  if (e.touches && e.touches.length > 1) return; // support one finger touch only
  const el = e.target,
    role = el.getAttribute('data-role'),
    color = el.getAttribute('data-color'),
    n = Number(el.getAttribute('data-nb'));
  if (n === 0) return;
  const piece = {
    role,
    color
  };
  const previouslySelected = s.selectable.selected;
  if (!previouslySelected && s.drawable.enabled && (s.drawable.eraseOnClick || piece.color !== s.turnColor)) (0, _draw.clear)(s);
  // Prevent touch scroll and create no corresponding mouse event
  if (e.cancelable !== false) e.preventDefault();
  const hadPremove = !!s.premovable.current;
  s.stats.ctrlKey = e.ctrlKey;
  board.select(s, piece);
  const selected = s.selectable.selected;
  const stillSelected = selected && util.isSame(selected, piece);
  if (stillSelected && board.isDraggable(s, piece, true)) {
    (0, _drag.dragNewPiece)(s, piece, true, e, previouslySelected);
  } else {
    if (hadPremove) board.unsetPremove(s);
  }
  s.dom.redraw();
}

},{"./board.js":4,"./drag.js":7,"./draw.js":8,"./util.js":20}],13:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.predrop = predrop;
var util = _interopRequireWildcard(require("./util.js"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
const wholeBoard = () => true;
/**
 *
 * @param from	0-based index from given color's PoV, inclusive
 * @param to	0-based index from given color's PoV, exclusive
 * @param color The piece's color
 * @param bd    The board's dimensions
 *
 * Returns a function that checks if a position's rank is inside the from-to range, where from and to are indices of rank when counting from
 * current "color"'s point of view (i.e. if from=to=1 and color=black the function will return true only if the position's rank is 8 in case of 8x8 board)
 * from and to can be zero or negative to denote that many ranks counting from the last
 *
 * */
function rankRange(from, to, color, bd) {
  if (from < 0) from += bd.height;
  if (to < 0) to += bd.height;
  return (_x, y) => {
    if (color === 'black') y = bd.height - 1 - y;
    return from <= y && y < to;
  };
}
function predrop(variant, bd) {
  const mobility = builtinMobility(variant, bd);
  return (boardState, piece) => util.allPos(bd).filter(pos => {
    var _a;
    return ((_a = boardState.pieces.get(util.pos2key(pos))) === null || _a === void 0 ? void 0 : _a.color) !== piece.color && mobility(piece)(pos[0], pos[1]);
  }).map(util.pos2key);
}
function builtinMobility(variant, bd) {
  switch (variant) {
    case 'crazyhouse':
    case 'shouse':
    case 'capahouse':
    case 'gothhouse':
      // pawns can't be dropped on the first or last rank
      return piece => piece.role === 'p-piece' ? rankRange(1, -1, piece.color, bd) : wholeBoard;
    case 'placement':
      // the "drop" is the placement phase where pieces can only be placed on the first rank
      return piece => rankRange(0, 1, piece.color, bd);
    case 'sittuyin':
      // the "drop" is the placement phase where pieces can only be placed on the player's half
      // rooks can only be dropped on the first rank
      return piece => piece.role === 'r-piece' ? rankRange(0, 1, piece.color, bd) : rankRange(0, 3, piece.color, bd);
    case 'shogi':
    case 'minishogi':
    case 'gorogoro':
    case 'gorogoroplus':
      return piece => {
        switch (piece.role) {
          case 'p-piece': // pawns and lances can't be dropped on the last rank
          case 'l-piece':
            return rankRange(0, -1, piece.color, bd);
          case 'n-piece':
            // knights can't be dropped on the last two ranks
            return rankRange(0, -2, piece.color, bd);
          default:
            return wholeBoard;
        }
      };
    case 'torishogi':
      // swallows can't be dropped on the last rank
      return piece => piece.role === 's-piece' ? rankRange(0, -1, piece.color, bd) : wholeBoard;
    case 'grandhouse':
      // pawns can't be dropped on the 1st, or 8th to 10th ranks
      return piece => piece.role === 'p-piece' ? rankRange(1, 7, piece.color, bd) : wholeBoard;
    case 'shogun':
      // shogun only permits drops on ranks 1-5 for all pieces
      return piece => rankRange(0, 5, piece.color, bd);
    case 'synochess':
      // Only black can drop, and the only droppable rank is the literal rank five.
      return () => (_x, y) => y === 4;
    case 'shinobi':
      // Only white can drop, and only on their own half of the board
      return () => (_x, y) => y <= 3;
    case 'mansindam':
      return piece => {
        switch (piece.role) {
          case 'p-piece':
            // pawns can't be dropped on the last rank
            return rankRange(0, -1, piece.color, bd);
          default:
            return wholeBoard;
        }
      };
    // These cases are unnecessary but is here anyway to be explicit
    case 'kyotoshogi':
    case 'dobutsu':
    case 'chennis':
    default:
      return () => wholeBoard;
  }
}

},{"./util.js":20}],14:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.knight = exports.janggiElephant = void 0;
exports.premove = premove;
exports.queen = void 0;
var util = _interopRequireWildcard(require("./util.js"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
const diff = (a, b) => Math.abs(a - b);
const pawn = color => (x1, y1, x2, y2) => diff(x1, x2) < 2 && (color === 'white' ?
// allow 2 squares from first two ranks, for horde
y2 === y1 + 1 || y1 <= 1 && y2 === y1 + 2 && x1 === x2 : y2 === y1 - 1 || y1 >= 6 && y2 === y1 - 2 && x1 === x2);
const knight = (x1, y1, x2, y2) => {
  const xd = diff(x1, x2);
  const yd = diff(y1, y2);
  return xd === 1 && yd === 2 || xd === 2 && yd === 1;
};
exports.knight = knight;
const bishop = (x1, y1, x2, y2) => {
  return diff(x1, x2) === diff(y1, y2);
};
const rook = (x1, y1, x2, y2) => {
  return x1 === x2 || y1 === y2;
};
const queen = (x1, y1, x2, y2) => {
  return bishop(x1, y1, x2, y2) || rook(x1, y1, x2, y2);
};
exports.queen = queen;
const king = (color, rookFiles, canCastle) => (x1, y1, x2, y2) => diff(x1, x2) < 2 && diff(y1, y2) < 2 || canCastle && y1 === y2 && y1 === (color === 'white' ? 0 : 7) && (x1 === 4 && (x2 === 2 && rookFiles.includes(0) || x2 === 6 && rookFiles.includes(7)) || rookFiles.includes(x2));
function rookFilesOf(pieces, color) {
  const backrank = color === 'white' ? '1' : '8';
  const files = [];
  for (const [key, piece] of pieces) {
    if (key[1] === backrank && piece.color === color && piece.role === 'r-piece') {
      files.push(util.key2pos(key)[0]);
    }
  }
  return files;
}
function and(...ms) {
  return (x1, y1, x2, y2) => ms.map(m => m(x1, y1, x2, y2)).reduce((a, b) => a && b);
}
function or(...ms) {
  return (x1, y1, x2, y2) => ms.map(m => m(x1, y1, x2, y2)).reduce((a, b) => a || b);
}
/* TODO make use of this
function not(m: Mobility): Mobility {
  return (x1, y1, x2, y2) => !m(x1, y1, x2, y2);
}
*/
function _distance(dist) {
  return (x1, y1, x2, y2) => Math.max(diff(x1, x2), diff(y1, y2)) <= dist;
}
function memoizeDistance() {
  const cache = {};
  return dist => {
    const key = `${dist}`;
    if (!(key in cache)) cache[key] = _distance(dist);
    return cache[key];
  };
}
const distance = memoizeDistance();
function backrank(color) {
  return color === 'white' ? 0 : 7;
}
// king without castling
const kingNoCastling = (x1, y1, x2, y2) => {
  return diff(x1, x2) < 2 && diff(y1, y2) < 2;
};
// 960 king (can only castle with king takes rook)
function king960(color, rookFiles, canCastle) {
  return (x1, y1, x2, y2) => kingNoCastling(x1, y1, x2, y2) || canCastle && y1 === y2 && y1 === backrank(color) && rookFiles.includes(x2);
}
// capablanca king (different castling files from standard chess king)
function kingCapa(color, rookFiles, canCastle) {
  return (x1, y1, x2, y2) => kingNoCastling(x1, y1, x2, y2) || canCastle && y1 === y2 && y1 === backrank(color) && x1 === 5 && (x2 === 8 && rookFiles.includes(9) || x2 === 2 && rookFiles.includes(0));
}
// shako king (different castling files and ranks from standard chess king)
function kingShako(color, rookFiles, canCastle) {
  return (x1, y1, x2, y2) => kingNoCastling(x1, y1, x2, y2) || canCastle && y1 === y2 && y1 === (color === 'white' ? 1 : 8) && x1 === 5 && (x2 === 7 && rookFiles.includes(8) || x2 === 3 && rookFiles.includes(1));
}
function rookFilesOfShako(pieces, color) {
  const backrank = color === 'white' ? '2' : '9';
  const files = [];
  for (const [key, piece] of pieces) {
    if (key[1] === backrank && piece.color === color && piece.role === 'r-piece') {
      files.push(util.key2pos(key)[0]);
    }
  }
  return files;
}
// ouk king (can jump like a knight to the second row on its first move)
function kingOuk(color, canCastle) {
  return (x1, y1, x2, y2) => kingNoCastling(x1, y1, x2, y2) || canCastle && (color === 'white' ? x1 === 3 && y1 === 0 && (x2 === 1 || x2 === 5) && y2 === 1 : x1 === 4 && y1 === 7 && (x2 === 6 || x2 === 2) && y2 === 6);
}
function pawnNoDoubleStep(color) {
  return (x1, y1, x2, y2) => diff(x1, x2) < 2 && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1);
}
// grand pawn (10x10 board, can move two squares on third row)
function pawnGrand(color) {
  return (x1, y1, x2, y2) => diff(x1, x2) < 2 && (color === 'white' ? y2 === y1 + 1 || y1 <= 2 && y2 === y1 + 2 && x1 === x2 : y2 === y1 - 1 || y1 >= 7 && y2 === y1 - 2 && x1 === x2);
}
// sittuyin pawn (8x8 board, can move diagonally backward to promote on some squares)
function pawnSittuyin(pieces, color) {
  return (x1, y1, x2, y2) => {
    let canPromote = (color === 'white' ? y1 >= 4 : y1 <= 3) && (x1 === y1 || 7 - x1 === y1);
    if (!canPromote) {
      let pawnCount = 0;
      for (const p of pieces.values()) if (p.role === 'p-piece' && p.color === color) pawnCount += 1;
      canPromote || (canPromote = pawnCount === 1);
    }
    return pawnNoDoubleStep(color)(x1, y1, x2, y2) || canPromote && ferz(x1, y1, x2, y2);
  };
}
function pawnBerolina(color) {
  return (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    return color === 'white' ?
    // allow 2 squares from first two ranks, for horde
    y2 === y1 + 1 && xd <= 1 || y1 <= 1 && y2 === y1 + 2 && xd === 2 : y2 === y1 - 1 && xd <= 1 || y1 >= 6 && y2 === y1 - 2 && xd === 2;
  };
}
const pawnAtaxx = (x1, y1, x2, y2) => {
  return diff(x1, x2) <= 2 && diff(y1, y2) <= 2;
};
const sideways = (x1, y1, x2, y2) => {
  return y1 === y2 && diff(x1, x2) <= 1;
};
// wazir
const wazir = (x1, y1, x2, y2) => {
  const xd = diff(x1, x2);
  const yd = diff(y1, y2);
  return xd === 1 && yd === 0 || xd === 0 && yd === 1;
};
// ferz, met
const ferz = (x1, y1, x2, y2) => diff(x1, x2) === diff(y1, y2) && diff(x1, x2) === 1;
const fersAlfil = (x1, y1, x2, y2) => {
  return diff(x1, x2) === diff(y1, y2) && diff(x1, x2) < 3;
};
const wazirDabbaba = (x1, y1, x2, y2) => {
  return x1 === x2 && diff(y1, y2) < 3 || y1 === y2 && diff(x1, x2) < 3;
};
// ouk ferz (can jump two squares forward on its first move)
function ferzOuk(color) {
  return (x1, y1, x2, y2) => ferz(x1, y1, x2, y2) || (color === 'white' ? x1 === 4 && y1 === 0 && x2 === 4 && y2 === 2 : x1 === 3 && y1 === 7 && x2 === 3 && y2 === 5);
}
// alfil (shatranj elephant)
const elephant = (x1, y1, x2, y2) => {
  const xd = diff(x1, x2);
  const yd = diff(y1, y2);
  return xd === yd && xd === 2;
};
// archbishop (knight + bishop)
const archbishop = (x1, y1, x2, y2) => {
  return bishop(x1, y1, x2, y2) || knight(x1, y1, x2, y2);
};
// chancellor (knight + rook)
const chancellor = (x1, y1, x2, y2) => {
  return rook(x1, y1, x2, y2) || knight(x1, y1, x2, y2);
};
// amazon (knight + queen)
const amazon = (x1, y1, x2, y2) => {
  return bishop(x1, y1, x2, y2) || rook(x1, y1, x2, y2) || knight(x1, y1, x2, y2);
};
// mansindam rhino (archbishop + wazir)
const crownPrincess = (x1, y1, x2, y2) => {
  return bishop(x1, y1, x2, y2) || knight(x1, y1, x2, y2) || wazir(x1, y1, x2, y2);
};
// mansindam ship (chancellor + ferz)
const archChancellor = (x1, y1, x2, y2) => {
  return rook(x1, y1, x2, y2) || knight(x1, y1, x2, y2) || ferz(x1, y1, x2, y2);
};
// shogun general (knight + king)
const centaur = (x1, y1, x2, y2) => {
  return kingNoCastling(x1, y1, x2, y2) || knight(x1, y1, x2, y2);
};
// shogi lance
function shogiLance(color) {
  return (x1, y1, x2, y2) => x2 === x1 && (color === 'white' ? y2 > y1 : y2 < y1);
}
// shogi silver, makruk khon, sittuyin elephant
function shogiSilver(color) {
  return (x1, y1, x2, y2) => ferz(x1, y1, x2, y2) || x1 === x2 && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1);
}
// shogi gold, promoted pawn/knight/lance/silver
function shogiGold(color) {
  return (x1, y1, x2, y2) => wazir(x1, y1, x2, y2) || diff(x1, x2) < 2 && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1);
}
// shogi pawn
function shogiPawn(color) {
  return (x1, y1, x2, y2) => x2 === x1 && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1);
}
// shogi knight
function shogiKnight(color) {
  return (x1, y1, x2, y2) => (x2 === x1 - 1 || x2 === x1 + 1) && (color === 'white' ? y2 === y1 + 2 : y2 === y1 - 2);
}
// shogi promoted rook (dragon king)
const shogiDragon = (x1, y1, x2, y2) => {
  return rook(x1, y1, x2, y2) || ferz(x1, y1, x2, y2);
};
// shogi promoted bishop (dragon horse)
const shogiHorse = (x1, y1, x2, y2) => {
  return bishop(x1, y1, x2, y2) || wazir(x1, y1, x2, y2);
};
// cannon shogi promoted orthogonal (silver/gold) cannons
const flyingOrthogonalCannon = (x1, y1, x2, y2) => {
  return rook(x1, y1, x2, y2) || fersAlfil(x1, y1, x2, y2);
};
// cannon shogi promoted diagonal (iron/copper) cannons
const flyingDiagonalCannon = (x1, y1, x2, y2) => {
  return bishop(x1, y1, x2, y2) || wazirDabbaba(x1, y1, x2, y2);
};
function scout(color) {
  return (x1, y1, x2, y2) => x2 === x1 && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1) || (x2 === x1 - 1 || x2 === x1 + 1) && (color === 'white' ? y2 === y1 + 2 : y2 === y1 - 2) || (x2 === x1 - 2 || x2 === x1 + 2) && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1);
}
function _palace(bd, color) {
  const middleFile = Math.floor(bd.width / 2);
  const startingRank = color === 'white' ? 0 : bd.height - 3;
  return [[middleFile - 1, startingRank + 2], [middleFile, startingRank + 2], [middleFile + 1, startingRank + 2], [middleFile - 1, startingRank + 1], [middleFile, startingRank + 1], [middleFile + 1, startingRank + 1], [middleFile - 1, startingRank], [middleFile, startingRank], [middleFile + 1, startingRank]];
}
function memoizePalace() {
  const cache = {};
  return (bd, color) => {
    const key = `${bd.width}x${bd.height}${color.slice(0, 1)}`;
    if (!(key in cache)) cache[key] = _palace(bd, color);
    return cache[key];
  };
}
const palace = memoizePalace();
// xiangqi pawn
function xiangqiPawn(color) {
  return (x1, y1, x2, y2) => x2 === x1 && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1) || y2 === y1 && diff(x1, x2) < 2 && (color === 'white' ? y1 > 4 : y1 < 5);
}
// minixiangqi pawn
function minixiangqiPawn(color) {
  return (x1, y1, x2, y2) => x2 === x1 && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1) || y2 === y1 && diff(x1, x2) < 2;
}
// xiangqi elephant
function xiangqiElephant(color) {
  return (x1, y1, x2, y2) => elephant(x1, y1, x2, y2) && (color === 'white' ? y2 < 5 : y2 > 4);
}
// xiangqi advisor
function xiangqiAdvisor(color, bd) {
  const p = palace(bd, color);
  return (x1, y1, x2, y2) => ferz(x1, y1, x2, y2) && p.some(point => point[0] === x2 && point[1] === y2);
}
// xiangqi general (king)
function xiangqiKing(color, bd) {
  const p = palace(bd, color);
  return (x1, y1, x2, y2) => wazir(x1, y1, x2, y2) && p.some(point => point[0] === x2 && point[1] === y2);
}
// janggi elephant
const janggiElephant = (x1, y1, x2, y2) => {
  const xd = diff(x1, x2);
  const yd = diff(y1, y2);
  return xd === 2 && yd === 3 || xd === 3 && yd === 2;
};
// janggi pawn
exports.janggiElephant = janggiElephant;
function janggiPawn(color, bd) {
  const oppPalace = palace(bd, util.opposite(color));
  return (x1, y1, x2, y2) => {
    const palacePos = oppPalace.findIndex(point => point[0] === x1 && point[1] === y1);
    let additionalMobility;
    switch (palacePos) {
      case 0:
        additionalMobility = (x1, y1, x2, y2) => x2 === x1 + 1 && color === 'black' && y2 === y1 - 1;
        break;
      case 2:
        additionalMobility = (x1, y1, x2, y2) => x2 === x1 - 1 && color === 'black' && y2 === y1 - 1;
        break;
      case 4:
        additionalMobility = (x1, y1, x2, y2) => diff(x1, x2) === 1 && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1);
        break;
      case 6:
        additionalMobility = (x1, y1, x2, y2) => x2 === x1 + 1 && color === 'white' && y2 === y1 + 1;
        break;
      case 8:
        additionalMobility = (x1, y1, x2, y2) => x2 === x1 - 1 && color === 'white' && y2 === y1 + 1;
        break;
      default:
        additionalMobility = () => false;
    }
    return minixiangqiPawn(color)(x1, y1, x2, y2) || additionalMobility(x1, y1, x2, y2);
  };
}
// janggi rook
function janggiRook(bd) {
  const wPalace = palace(bd, 'white');
  const bPalace = palace(bd, 'black');
  return (x1, y1, x2, y2) => {
    let additionalMobility;
    const wPalacePos = wPalace.findIndex(point => point[0] === x1 && point[1] === y1);
    const bPalacePos = bPalace.findIndex(point => point[0] === x1 && point[1] === y1);
    const palacePos = wPalacePos !== -1 ? wPalacePos : bPalacePos;
    const xd = diff(x1, x2);
    const yd = diff(y1, y2);
    switch (palacePos) {
      case 0:
        additionalMobility = (x1, y1, x2, y2) => xd === yd && x2 > x1 && x2 <= x1 + 2 && y2 < y1 && y2 >= y1 - 2;
        break;
      case 2:
        additionalMobility = (x1, y1, x2, y2) => xd === yd && x2 < x1 && x2 >= x1 - 2 && y2 < y1 && y2 >= y1 - 2;
        break;
      case 4:
        additionalMobility = ferz;
        break;
      case 6:
        additionalMobility = (x1, y1, x2, y2) => xd === yd && x2 > x1 && x2 <= x1 + 2 && y2 > y1 && y2 <= y1 + 2;
        break;
      case 8:
        additionalMobility = (x1, y1, x2, y2) => xd === yd && x2 < x1 && x2 >= x1 - 2 && y2 > y1 && y2 <= y1 + 2;
        break;
      default:
        additionalMobility = () => false;
    }
    return rook(x1, y1, x2, y2) || additionalMobility(x1, y1, x2, y2);
  };
}
// janggi general (king)
function janggiKing(color, bd) {
  const ownPalace = palace(bd, color);
  return (x1, y1, x2, y2) => {
    const palacePos = ownPalace.findIndex(point => point[0] === x1 && point[1] === y1);
    let additionalMobility;
    switch (palacePos) {
      case 0:
        additionalMobility = (x1, y1, x2, y2) => x2 === x1 + 1 && y2 === y1 - 1;
        break;
      case 2:
        additionalMobility = (x1, y1, x2, y2) => x2 === x1 - 1 && y2 === y1 - 1;
        break;
      case 4:
        additionalMobility = ferz;
        break;
      case 6:
        additionalMobility = (x1, y1, x2, y2) => x2 === x1 + 1 && y2 === y1 + 1;
        break;
      case 8:
        additionalMobility = (x1, y1, x2, y2) => x2 === x1 - 1 && y2 === y1 + 1;
        break;
      default:
        additionalMobility = () => false;
    }
    return (wazir(x1, y1, x2, y2) || additionalMobility(x1, y1, x2, y2)) && ownPalace.some(point => point[0] === x2 && point[1] === y2);
  };
}
// musketeer leopard
const musketeerLeopard = (x1, y1, x2, y2) => {
  const xd = diff(x1, x2);
  const yd = diff(y1, y2);
  return (xd === 1 || xd === 2) && (yd === 1 || yd === 2);
};
// musketeer hawk
const musketeerHawk = (x1, y1, x2, y2) => {
  const xd = diff(x1, x2);
  const yd = diff(y1, y2);
  return xd === 0 && (yd === 2 || yd === 3) || yd === 0 && (xd === 2 || xd === 3) || xd === yd && (xd === 2 || xd === 3);
};
// musketeer elephant
const musketeerElephant = (x1, y1, x2, y2) => {
  const xd = diff(x1, x2);
  const yd = diff(y1, y2);
  return xd === 1 || yd === 1 || xd === 2 && (yd === 0 || yd === 2) || xd === 0 && yd === 2;
};
// musketeer cannon
const musketeerCannon = (x1, y1, x2, y2) => {
  const xd = diff(x1, x2);
  const yd = diff(y1, y2);
  return xd < 3 && (yd < 2 || yd === 2 && xd === 0);
};
// musketeer unicorn
const musketeerUnicorn = (x1, y1, x2, y2) => {
  const xd = diff(x1, x2);
  const yd = diff(y1, y2);
  return knight(x1, y1, x2, y2) || xd === 1 && yd === 3 || xd === 3 && yd === 1;
};
// musketeer dragon
const musketeerDragon = (x1, y1, x2, y2) => {
  return knight(x1, y1, x2, y2) || queen(x1, y1, x2, y2);
};
// musketeer fortress
const musketeerFortress = (x1, y1, x2, y2) => {
  const xd = diff(x1, x2);
  const yd = diff(y1, y2);
  return xd === yd && xd < 4 || yd === 0 && xd === 2 || yd === 2 && xd < 2;
};
// musketeer spider
const musketeerSpider = (x1, y1, x2, y2) => {
  const xd = diff(x1, x2);
  const yd = diff(y1, y2);
  return xd < 3 && yd < 3 && !(xd === 1 && yd === 0) && !(xd === 0 && yd === 1);
};
// tori shogi goose (promoted swallow)
function toriGoose(color) {
  return (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    return color === 'white' ? xd === 2 && y2 === y1 + 2 || xd === 0 && y2 === y1 - 2 : xd === 2 && y2 === y1 - 2 || xd === 0 && y2 === y1 + 2;
  };
}
// tori shogi left quail
function toriLeftQuail(color) {
  return (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    const yd = diff(y1, y2);
    return color === 'white' ? x2 === x1 && y2 > y1 || xd === yd && x2 > x1 && y2 < y1 || x2 === x1 - 1 && y2 === y1 - 1 : x2 === x1 && y2 < y1 || xd === yd && x2 < x1 && y2 > y1 || x2 === x1 + 1 && y2 === y1 + 1;
  };
}
// tori shogi right quail
function toriRightQuail(color) {
  return (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    const yd = diff(y1, y2);
    return color === 'white' ? x2 === x1 && y2 > y1 || xd === yd && x2 < x1 && y2 < y1 || x2 === x1 + 1 && y2 === y1 - 1 : x2 === x1 && y2 < y1 || xd === yd && x2 > x1 && y2 > y1 || x2 === x1 - 1 && y2 === y1 + 1;
  };
}
// tori shogi pheasant
function toriPheasant(color) {
  return (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    return color === 'white' ? x2 === x1 && y2 === y1 + 2 || xd === 1 && y2 === y1 - 1 : x2 === x1 && y2 === y1 - 2 || xd === 1 && y2 === y1 + 1;
  };
}
// tori shogi crane
const toriCrane = (x1, y1, x2, y2) => {
  return kingNoCastling(x1, y1, x2, y2) && y2 !== y1;
};
// tori shogi falcon
function toriFalcon(color) {
  return (x1, y1, x2, y2) => {
    return color === 'white' ? kingNoCastling(x1, y1, x2, y2) && !(x2 === x1 && y2 === y1 - 1) : kingNoCastling(x1, y1, x2, y2) && !(x2 === x1 && y2 === y1 + 1);
  };
}
// tori shogi eagle (promoted falcon)
function toriEagle(color) {
  return (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    const yd = diff(y1, y2);
    return color === 'white' ? kingNoCastling(x1, y1, x2, y2) || xd === yd && (y2 > y1 || y2 < y1 && yd <= 2) || x2 === x1 && y2 < y1 : kingNoCastling(x1, y1, x2, y2) || xd === yd && (y2 < y1 || y2 > y1 && yd <= 2) || x2 === x1 && y2 > y1;
  };
}
// chak pawn
function pawnChak(color) {
  return (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    return color === 'white' ? y2 >= y1 && y2 - y1 <= 1 && xd <= 1 : y1 >= y2 && y1 - y2 <= 1 && xd <= 1;
  };
}
// chak warrior
function chakWarrior(color) {
  return (x1, y1, x2, y2) => toriCrane(x1, y1, x2, y2) && (color === 'white' ? y2 >= 4 : y2 <= 4);
}
// chak divine king
function chakDivineKing(color) {
  return (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    const yd = diff(y1, y2);
    return queen(x1, y1, x2, y2) && xd <= 2 && yd <= 2 && (color === 'white' ? y2 >= 4 : y2 <= 4);
  };
}
// chennis king
function kingChennis(color) {
  return (x1, y1, x2, y2) => kingNoCastling(x1, y1, x2, y2) && x2 >= 1 && x2 <= 5 && (color === 'white' ? y2 <= 3 : y2 >= 3);
}
// cannot premove
const noMove = () => false;
function premove(variant, chess960, bd) {
  const mobility = builtinMobility(variant, chess960, bd);
  return (boardState, key, canCastle) => {
    const pos = util.key2pos(key);
    return util.allPos(bd).filter(pos2 => (pos[0] !== pos2[0] || pos[1] !== pos2[1]) && mobility(boardState, key, canCastle)(pos[0], pos[1], pos2[0], pos2[1])).map(util.pos2key);
  };
}
function builtinMobility(variant, chess960, bd) {
  switch (variant) {
    case 'ataxx':
      return (boardState, key) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        switch (role) {
          case 'p-piece':
            // pawn
            return pawnAtaxx;
          default:
            return noMove;
        }
      };
    case 'xiangqi':
    case 'manchu':
      return (boardState, key) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'p-piece':
            // pawn (soldier)
            return xiangqiPawn(color);
          case 'c-piece': // cannon
          case 'r-piece':
            // chariot
            return rook;
          case 'n-piece':
            // horse
            return knight;
          case 'b-piece':
            // elephant
            return xiangqiElephant(color);
          case 'a-piece':
            // advisor
            return xiangqiAdvisor(color, bd);
          case 'k-piece':
            // king
            return xiangqiKing(color, bd);
          case 'm-piece':
            // banner
            return chancellor;
          default:
            return noMove;
        }
      };
    case 'janggi':
      return (boardState, key) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'p-piece':
            // pawn (soldier)
            return janggiPawn(color, bd);
          case 'c-piece': // cannon
          case 'r-piece':
            // chariot
            return janggiRook(bd);
          case 'n-piece':
            // horse
            return knight;
          case 'b-piece':
            // elephant
            return janggiElephant;
          case 'a-piece': // advisor
          case 'k-piece':
            // king
            return janggiKing(color, bd);
          default:
            return noMove;
        }
      };
    case 'minixiangqi':
      return (boardState, key) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'p-piece':
            // pawn (soldier
            return minixiangqiPawn(color);
          case 'c-piece': // cannon
          case 'r-piece':
            // chariot
            return rook;
          case 'n-piece':
            // horse
            return knight;
          case 'k-piece':
            // king
            return xiangqiKing(color, bd);
          default:
            return noMove;
        }
      };
    case 'shogi':
    case 'minishogi':
    case 'gorogoro':
    case 'gorogoroplus':
    case 'cannonshogi':
      return (boardState, key) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'p-piece':
            // pawn
            return variant === 'cannonshogi' ? minixiangqiPawn(color) : shogiPawn(color);
          case 'l-piece':
            // lance
            return shogiLance(color);
          case 'n-piece':
            // knight
            return shogiKnight(color);
          case 'k-piece':
            // king
            return kingNoCastling;
          case 's-piece':
            // silver
            return shogiSilver(color);
          case 'g-piece': // gold
          case 'pp-piece': // tokin
          case 'pl-piece': // promoted lance
          case 'pn-piece': // promoted knight
          case 'ps-piece':
            // promoted silver
            return shogiGold(color);
          case 'b-piece': // bishop
          case 'i-piece': // iron cannon
          case 'c-piece':
            // copper cannon
            return bishop;
          case 'r-piece': // rook
          case 'u-piece': // gold cannon
          case 'a-piece':
            // silver cannon
            return rook;
          case 'pr-piece':
            // dragon (promoted rook)
            return shogiDragon;
          case 'pb-piece':
            // horse (promoted bishop), not to be confused with the knight
            return shogiHorse;
          case 'pu-piece': // promoted gold cannon
          case 'pa-piece':
            // promoted silver cannon
            return flyingOrthogonalCannon;
          case 'pi-piece': // promoted iron cannon
          case 'pc-piece':
            // promoted copper cannon
            return flyingDiagonalCannon;
          default:
            return noMove;
        }
      };
    case 'kyotoshogi':
      return (boardState, key) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'l-piece':
            // kyoto - lance-tokin
            return shogiLance(color);
          case 'pl-piece':
            return shogiGold(color);
          case 's-piece':
            // ginkaku - silver-bishop
            return shogiSilver(color);
          case 'ps-piece':
            return bishop;
          case 'n-piece':
            // kinkei gold-knight
            return shogiKnight(color);
          case 'pn-piece':
            return shogiGold(color);
          case 'p-piece':
            // hifu - rook-pawn
            return shogiPawn(color);
          case 'pp-piece':
            return rook;
          case 'k-piece':
            // king
            return kingNoCastling;
          default:
            return noMove;
        }
      };
    case 'dobutsu':
      return (boardState, key) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'c-piece':
            // chick
            return shogiPawn(color);
          case 'e-piece':
            // elephant
            return ferz;
          case 'g-piece':
            // giraffe
            return wazir;
          case 'l-piece':
            // lion
            return kingNoCastling;
          case 'pc-piece':
            // hen (promoted chick)
            return shogiGold(color);
          default:
            return noMove;
        }
      };
    case 'torishogi':
      return (boardState, key) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 's-piece':
            // swallow
            return shogiPawn(color);
          case 'ps-piece':
            // goose (promoted swallow)
            return toriGoose(color);
          case 'l-piece':
            // left quail
            return toriLeftQuail(color);
          case 'r-piece':
            // right quail
            return toriRightQuail(color);
          case 'p-piece':
            // pheasant (NOT pawn)
            return toriPheasant(color);
          case 'c-piece':
            // crane
            return toriCrane;
          case 'f-piece':
            // falcon
            return toriFalcon(color);
          case 'pf-piece':
            // eagle (promoted falcon)
            return toriEagle(color);
          case 'k-piece':
            // phoenix
            return kingNoCastling;
          default:
            return noMove;
        }
      };
    case 'makruk':
    case 'makpong':
    case 'sittuyin':
    case 'cambodian':
    case 'asean':
      return (boardState, key, canCastle) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'p-piece':
            // pawn
            return variant === 'sittuyin' ? pawnSittuyin(boardState.pieces, color) : pawnNoDoubleStep(color);
          case 'r-piece':
            // rook
            return rook;
          case 'n-piece':
            // knight
            return knight;
          case 'b-piece': // ASEAN khon
          case 's-piece':
            // khon
            return shogiSilver(color);
          case 'q-piece': // ASEAN met
          case 'f-piece': // Sittuyin ferz
          case 'm-piece':
            // met
            return variant === 'cambodian' ? ferzOuk(color) : ferz;
          case 'k-piece':
            // king
            return variant === 'cambodian' ? kingOuk(color, canCastle) : kingNoCastling;
          default:
            return noMove;
        }
      };
    case 'shatranj':
      return (boardState, key) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'p-piece':
            // pawn
            return pawnNoDoubleStep(color);
          case 'r-piece':
            // rook
            return rook;
          case 'n-piece':
            // knight
            return knight;
          case 'b-piece':
            // bishop
            return elephant;
          case 'q-piece':
            // queen
            return ferz;
          case 'k-piece':
            // king
            return kingNoCastling;
          default:
            return noMove;
        }
      };
    case 'grand':
    case 'grandhouse':
      return (boardState, key) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'p-piece':
            // pawn
            return pawnGrand(color);
          case 'r-piece':
            // rook
            return rook;
          case 'n-piece':
            // knight
            return knight;
          case 'b-piece':
            // bishop
            return bishop;
          case 'q-piece':
            // queen
            return queen;
          case 'c-piece':
            // chancellor
            return chancellor;
          case 'a-piece':
            // archbishop
            return archbishop;
          case 'k-piece':
            // king
            return kingNoCastling;
          default:
            return noMove;
        }
      };
    case 'shako':
      return (boardState, key, canCastle) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'p-piece':
            // pawn
            return pawnGrand(color);
          case 'c-piece': // cannon
          case 'r-piece':
            // rook
            return rook;
          case 'n-piece':
            // knight
            return knight;
          case 'b-piece':
            // bishop
            return bishop;
          case 'q-piece':
            // queen
            return queen;
          case 'e-piece':
            // elephant
            return fersAlfil;
          case 'k-piece':
            // king
            return kingShako(color, rookFilesOfShako(boardState.pieces, color), canCastle);
          default:
            return noMove;
        }
      };
    case 'shogun':
      return (boardState, key, canCastle) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'p-piece':
            // pawn
            return pawn(color);
          case 'pp-piece':
            // captain
            return kingNoCastling;
          case 'r-piece':
            // rook
            return rook;
          case 'pr-piece':
            // mortar
            return chancellor;
          case 'n-piece':
            // knight
            return knight;
          case 'pn-piece':
            // general
            return centaur;
          case 'b-piece':
            // bishop
            return bishop;
          case 'pb-piece':
            // archbishop
            return archbishop;
          case 'f-piece':
            // duchess
            return ferz;
          case 'pf-piece':
            // queen
            return queen;
          case 'k-piece':
            // king
            return king(color, rookFilesOf(boardState.pieces, color), canCastle);
          default:
            return noMove;
        }
      };
    case 'orda':
    case 'khans':
    case 'ordamirror':
      return (boardState, key, canCastle) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'p-piece':
            // pawn
            return pawn(color);
          case 'r-piece':
            // rook
            return rook;
          case 'n-piece':
            // knight
            return knight;
          case 'b-piece':
            // bishop
            return bishop;
          case 'q-piece':
            // queen
            return queen;
          case 'l-piece':
            // lancer
            return chancellor;
          case 'h-piece': // kheshig
          case 't-piece':
            // khatun
            return centaur;
          case 'a-piece':
            // archer
            return archbishop;
          case 'y-piece':
            // yurt
            return shogiSilver(color);
          case 'f-piece':
            // falcon
            return amazon;
          case 's-piece':
            // scout
            return scout(color);
          case 'k-piece':
            // king
            return king(color, rookFilesOf(boardState.pieces, color), canCastle);
          default:
            return noMove;
        }
      };
    case 'synochess':
      return (boardState, key, canCastle) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'p-piece':
            // pawn
            return pawn(color);
          case 'c-piece': // cannon
          case 'r-piece':
            // rook
            return rook;
          case 'n-piece':
            // knight
            return knight;
          case 'b-piece':
            // bishop
            return bishop;
          case 'q-piece':
            // queen
            return queen;
          case 's-piece':
            // soldier
            return minixiangqiPawn(color);
          case 'e-piece':
            // elephant
            return fersAlfil;
          case 'a-piece':
            // advisor
            return kingNoCastling;
          case 'k-piece':
            // king
            return king(color, rookFilesOf(boardState.pieces, color), canCastle && color === 'white');
          default:
            return noMove;
        }
      };
    case 'musketeer':
      return (boardState, key, canCastle) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'p-piece':
            // pawn
            return pawn(color);
          case 'r-piece':
            // rook
            return rook;
          case 'n-piece':
            // knight
            return knight;
          case 'b-piece':
            // bishop
            return bishop;
          case 'q-piece':
            // queen
            return queen;
          case 'l-piece':
            // leopard
            return musketeerLeopard;
          case 'o-piece':
            // cannon
            return musketeerCannon;
          case 'u-piece':
            // unicorn
            return musketeerUnicorn;
          case 'd-piece':
            // dragon
            return musketeerDragon;
          case 'c-piece':
            // chancellor
            return chancellor;
          case 'a-piece':
            // archbishop
            return archbishop;
          case 'e-piece':
            // elephant
            return musketeerElephant;
          case 'h-piece':
            // hawk
            return musketeerHawk;
          // hawk
          case 'f-piece':
            // fortress
            return musketeerFortress;
          case 's-piece':
            // spider
            return musketeerSpider;
          case 'k-piece':
            return king(color, rookFilesOf(boardState.pieces, color), canCastle);
          default:
            return noMove;
        }
      };
    case 'hoppelpoppel':
      return (boardState, key, canCastle) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'p-piece':
            // pawn
            return pawn(color);
          case 'r-piece':
            // rook
            return rook;
          case 'n-piece': // knight (takes like bishop)
          case 'b-piece':
            // bishop (takes like knight)
            return archbishop;
          case 'q-piece':
            // queen
            return queen;
          case 'k-piece':
            // king
            return king(color, rookFilesOf(boardState.pieces, color), canCastle);
          default:
            return noMove;
        }
      };
    case 'mansindam':
      return (boardState, key) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'p-piece':
            // pawn
            return shogiPawn(color);
          case 'pp-piece':
            // guard
            return kingNoCastling;
          case 'r-piece':
            // rook
            return rook;
          case 'pr-piece':
            // tiger (promoted rook)
            return shogiDragon;
          case 'n-piece':
            // knight
            return knight;
          case 'pn-piece':
            // centaur (promoted knight)
            return centaur;
          case 'b-piece':
            // bishop
            return bishop;
          case 'pb-piece':
            // archer (promoted bishop)
            return shogiHorse;
          case 'c-piece':
            // cardinal
            return archbishop;
          case 'pc-piece':
            // rhino (promoted cardinal)
            return crownPrincess;
          case 'm-piece':
            // marshal
            return chancellor;
          case 'pm-piece':
            // ship (promoted marshal)
            return archChancellor;
          case 'a-piece':
            // angel
            return amazon;
          case 'q-piece':
            // queen
            return queen;
          case 'k-piece':
            // king
            return kingNoCastling;
          default:
            return noMove;
        }
      };
    case 'shinobi':
    case 'shinobiplus':
      return (boardState, key, canCastle) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'p-piece':
            // pawn
            return pawn(color);
          case 'pl-piece':
          case 'r-piece':
            // rook
            return rook;
          case 'ph-piece':
          case 'n-piece':
            // knight
            return knight;
          case 'pm-piece':
          case 'b-piece':
            // bishop
            return bishop;
          case 'q-piece':
            // queen
            return queen;
          case 'pp-piece':
          case 'c-piece':
            // captain
            return kingNoCastling;
          case 'l-piece':
            // lance
            return shogiLance(color);
          case 'h-piece':
            // horse
            return shogiKnight(color);
          case 'm-piece':
            // monk
            return ferz;
          case 'd-piece':
            // dragon
            return shogiDragon;
          case 'f-piece':
            // fox
            return shogiHorse;
          case 'j-piece':
            // ninja
            return archbishop;
          case 'k-piece':
            // king
            return king(color, rookFilesOf(boardState.pieces, color), canCastle);
          default:
            return noMove;
        }
      };
    case 'empire':
      return (boardState, key, canCastle) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'p-piece':
            // pawn
            return pawn(color);
          case 's-piece':
            // soldier
            return minixiangqiPawn(color);
          case 'r-piece':
            // rook
            return rook;
          case 'n-piece':
            // knight
            return knight;
          case 'b-piece':
            // bishop
            return bishop;
          case 'q-piece': // queen
          case 'd-piece': // duke
          case 't-piece': // tower
          case 'c-piece':
            // cardinal
            return queen;
          case 'e-piece':
            // eagle
            return amazon;
          case 'k-piece':
            // king
            return king(color, rookFilesOf(boardState.pieces, color), canCastle);
          default:
            return noMove;
        }
      };
    case 'chak':
      return (boardState, key) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'p-piece':
            // pawn
            return pawnChak(color);
          case 'pp-piece':
            // warrior
            return chakWarrior(color);
          case 'r-piece':
            // serpent
            return rook;
          case 'v-piece':
            // vulture
            return knight;
          case 's-piece':
            // shaman
            return toriCrane;
          case 'j-piece':
            // jaguar
            return centaur;
          case 'q-piece':
            // quetzal
            return queen;
          case 'k-piece':
            // king
            return kingNoCastling;
          case 'pk-piece':
            // divine king
            return chakDivineKing(color);
          case 'o-piece': // offering
          default:
            return noMove;
        }
      };
    case 'chennis':
      return (boardState, key) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'p-piece':
            // pawn
            return pawnNoDoubleStep(color);
          case 'pp-piece':
            // rook
            return rook;
          case 's-piece':
            // soldier
            return minixiangqiPawn(color);
          case 'ps-piece':
            // bishop
            return bishop;
          case 'f-piece':
            // ferz
            return ferz;
          case 'pf-piece':
            // cannon
            return rook;
          case 'm-piece':
            // mann
            return kingNoCastling;
          case 'pm-piece':
            // knight
            return knight;
          case 'k-piece':
            // king
            return kingChennis(color);
          default:
            return noMove;
        }
      };
    case 'spartan':
      return (boardState, key, canCastle) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'h-piece':
            // hoplite
            return pawnBerolina(color);
          case 'g-piece':
            // genaral
            return shogiDragon;
          case 'w-piece':
            // warlord
            return archbishop;
          case 'c-piece':
            // captain
            return and(rook, distance(2));
          case 'l-piece':
            // lieutenant
            return or(and(bishop, distance(2)), sideways);
          case 'p-piece':
            // pawn
            return pawn(color);
          case 'r-piece':
            // rook
            return rook;
          case 'n-piece':
            // knight
            return knight;
          case 'b-piece':
            // bishop
            return bishop;
          case 'q-piece':
            // queen
            return queen;
          case 'k-piece':
            // king
            return chess960 ? king960(color, rookFilesOf(boardState.pieces, color), canCastle) : king(color, rookFilesOf(boardState.pieces, color), canCastle);
          default:
            return noMove;
        }
      };
    case 'capablanca':
    case 'capahouse':
      return (boardState, key, canCastle) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'p-piece':
            // pawn
            return pawn(color);
          case 'r-piece':
            // rook
            return rook;
          case 'n-piece':
            // knight
            return knight;
          case 'b-piece':
            // bishop
            return bishop;
          case 'q-piece':
            // queen
            return queen;
          case 'c-piece':
            // chancellor
            return chancellor;
          case 'a-piece':
            // archbishop
            return archbishop;
          case 'k-piece':
            // king
            return chess960 ? king960(color, rookFilesOf(boardState.pieces, color), canCastle) : kingCapa(color, rookFilesOf(boardState.pieces, color), canCastle);
          default:
            return noMove;
        }
      };
    // Variants using standard pieces and additional fairy pieces like S-chess etc.
    default:
      return (boardState, key, canCastle) => {
        const piece = boardState.pieces.get(key);
        const role = piece.role;
        const color = piece.color;
        switch (role) {
          case 'p-piece':
            // pawn
            return pawn(color);
          case 'r-piece':
            // rook
            return rook;
          case 'n-piece':
            // knight
            return knight;
          case 'b-piece':
            // bishop
            return bishop;
          case 'q-piece':
            // queen
            return queen;
          case 'e-piece': // S-chess elephant
          case 'c-piece':
            // chancellor
            return chancellor;
          case 'h-piece': // S-chess hawk
          case 'a-piece': // archbishop
          case 'd-piece':
            // Dragon chess dragon
            return archbishop;
          case 'k-piece':
            // king
            return chess960 ? king960(color, rookFilesOf(boardState.pieces, color), canCastle) : king(color, rookFilesOf(boardState.pieces, color), canCastle);
          default:
            return noMove;
        }
      };
  }
}

},{"./util.js":20}],15:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.render = render;
exports.renderResized = renderResized;
exports.updateBounds = updateBounds;
var _util = require("./util.js");
var _board = require("./board.js");
// ported from https://github.com/lichess-org/lichobile/blob/master/src/chessground/render.ts
// in case of bugs, blame @veloce
function render(s) {
  const asWhite = (0, _board.whitePov)(s),
    posToTranslate = (0, _util.posToTranslate)(s.dom.bounds(), s.dimensions),
    boardEl = s.dom.elements.board,
    pieces = s.boardState.pieces,
    curAnim = s.animation.current,
    anims = curAnim ? curAnim.plan.anims : new Map(),
    fadings = curAnim ? curAnim.plan.fadings : new Map(),
    curDrag = s.draggable.current,
    squares = computeSquareClasses(s),
    samePieces = new Set(),
    sameSquares = new Set(),
    movedPieces = new Map(),
    movedSquares = new Map(); // by class name
  let k, el, pieceAtKey, elPieceName, anim, fading, pMvdset, pMvd, sMvdset, sMvd;
  // walk over all board dom elements, apply animations and flag moved pieces
  el = boardEl.firstChild;
  while (el) {
    k = el.cgKey;
    if (isPieceNode(el)) {
      pieceAtKey = pieces.get(k);
      anim = anims.get(k);
      fading = fadings.get(k);
      elPieceName = el.cgPiece;
      // if piece not being dragged anymore, remove dragging style
      if (el.cgDragging && (!curDrag || curDrag.orig !== k)) {
        el.classList.remove('dragging');
        (0, _util.translate)(el, posToTranslate((0, _util.key2pos)(k), asWhite));
        el.cgDragging = false;
      }
      // remove fading class if it still remains
      if (!fading && el.cgFading) {
        el.cgFading = false;
        el.classList.remove('fading');
      }
      // there is now a piece at this dom key
      if (pieceAtKey) {
        // continue animation if already animating and same piece
        // (otherwise it could animate a captured piece)
        if (anim && el.cgAnimating && elPieceName === (0, _util.pieceClasses)(pieceAtKey, s.orientation)) {
          const pos = (0, _util.key2pos)(k);
          pos[0] += anim[2];
          pos[1] += anim[3];
          el.classList.add('anim');
          (0, _util.translate)(el, posToTranslate(pos, asWhite));
        } else if (el.cgAnimating) {
          el.cgAnimating = false;
          el.classList.remove('anim');
          (0, _util.translate)(el, posToTranslate((0, _util.key2pos)(k), asWhite));
          if (s.addPieceZIndex) el.style.zIndex = posZIndex((0, _util.key2pos)(k), asWhite);
        }
        // same piece: flag as same
        if (elPieceName === (0, _util.pieceClasses)(pieceAtKey, s.orientation) && (!fading || !el.cgFading)) {
          samePieces.add(k);
        }
        // different piece: flag as moved unless it is a fading piece
        else {
          if (fading && elPieceName === (0, _util.pieceClasses)(fading, s.orientation)) {
            el.classList.add('fading');
            el.cgFading = true;
          } else {
            appendValue(movedPieces, elPieceName, el);
          }
        }
      }
      // no piece: flag as moved
      else {
        appendValue(movedPieces, elPieceName, el);
      }
    } else if (isSquareNode(el)) {
      const cn = el.className;
      if (squares.get(k) === cn) sameSquares.add(k);else appendValue(movedSquares, cn, el);
    }
    el = el.nextSibling;
  }
  // walk over all squares in current set, apply dom changes to moved squares
  // or append new squares
  for (const [sk, className] of squares) {
    if (!sameSquares.has(sk)) {
      sMvdset = movedSquares.get(className);
      sMvd = sMvdset && sMvdset.pop();
      const translation = posToTranslate((0, _util.key2pos)(sk), asWhite);
      if (sMvd) {
        sMvd.cgKey = sk;
        (0, _util.translate)(sMvd, translation);
      } else {
        const squareNode = (0, _util.createEl)('square', className);
        squareNode.cgKey = sk;
        (0, _util.translate)(squareNode, translation);
        boardEl.insertBefore(squareNode, boardEl.firstChild);
      }
    }
  }
  // walk over all pieces in current set, apply dom changes to moved pieces
  // or append new pieces
  for (const [k, p] of pieces) {
    anim = anims.get(k);
    if (!samePieces.has(k)) {
      pMvdset = movedPieces.get((0, _util.pieceClasses)(p, s.orientation));
      pMvd = pMvdset && pMvdset.pop();
      // a same piece was moved
      if (pMvd) {
        // apply dom changes
        pMvd.cgKey = k;
        if (pMvd.cgFading) {
          pMvd.classList.remove('fading');
          pMvd.cgFading = false;
        }
        const pos = (0, _util.key2pos)(k);
        if (s.addPieceZIndex) pMvd.style.zIndex = posZIndex(pos, asWhite);
        if (anim) {
          pMvd.cgAnimating = true;
          pMvd.classList.add('anim');
          pos[0] += anim[2];
          pos[1] += anim[3];
        }
        (0, _util.translate)(pMvd, posToTranslate(pos, asWhite));
      }
      // no piece in moved obj: insert the new piece
      // assumes the new piece is not being dragged
      else {
        const pieceName = (0, _util.pieceClasses)(p, s.orientation),
          pieceNode = (0, _util.createEl)('piece', pieceName),
          pos = (0, _util.key2pos)(k);
        pieceNode.cgPiece = pieceName;
        pieceNode.cgKey = k;
        if (anim) {
          pieceNode.cgAnimating = true;
          pos[0] += anim[2];
          pos[1] += anim[3];
        }
        (0, _util.translate)(pieceNode, posToTranslate(pos, asWhite));
        if (s.addPieceZIndex) pieceNode.style.zIndex = posZIndex(pos, asWhite);
        boardEl.appendChild(pieceNode);
      }
    }
  }
  // remove any element that remains in the moved sets
  for (const nodes of movedPieces.values()) removeNodes(s, nodes);
  for (const nodes of movedSquares.values()) removeNodes(s, nodes);
}
function renderResized(s) {
  const asWhite = (0, _board.whitePov)(s),
    posToTranslate = (0, _util.posToTranslate)(s.dom.bounds(), s.dimensions);
  let el = s.dom.elements.board.firstChild;
  while (el) {
    if (isPieceNode(el) && !el.cgAnimating || isSquareNode(el)) {
      (0, _util.translate)(el, posToTranslate((0, _util.key2pos)(el.cgKey), asWhite));
    }
    el = el.nextSibling;
  }
}
function updateBounds(s) {
  var _a, _b, _c, _d, _e, _f;
  const bounds = s.dom.elements.wrap.getBoundingClientRect();
  const container = s.dom.elements.container;
  const ratio = bounds.height / bounds.width;
  const width = Math.floor(bounds.width * window.devicePixelRatio / s.dimensions.width) * s.dimensions.width / window.devicePixelRatio;
  const height = width * ratio;
  container.style.width = width + 'px';
  container.style.height = height + 'px';
  s.dom.bounds.clear();
  const suffix = s.dimensionsCssVarsSuffix ? '-' + s.dimensionsCssVarsSuffix : '';
  (_a = s.addDimensionsCssVarsTo) === null || _a === void 0 ? void 0 : _a.style.setProperty('--cg-width' + suffix, width + 'px');
  (_b = s.addDimensionsCssVarsTo) === null || _b === void 0 ? void 0 : _b.style.setProperty('--cg-height' + suffix, height + 'px');
  (_c = s.dom.elements.pocketTop) === null || _c === void 0 ? void 0 : _c.style.setProperty('--cg-width' + suffix, width + 'px');
  (_d = s.dom.elements.pocketTop) === null || _d === void 0 ? void 0 : _d.style.setProperty('--cg-height' + suffix, height + 'px');
  (_e = s.dom.elements.pocketBottom) === null || _e === void 0 ? void 0 : _e.style.setProperty('--cg-width' + suffix, width + 'px');
  (_f = s.dom.elements.pocketBottom) === null || _f === void 0 ? void 0 : _f.style.setProperty('--cg-height' + suffix, height + 'px');
}
const isPieceNode = el => el.tagName === 'PIECE';
const isSquareNode = el => el.tagName === 'SQUARE';
function removeNodes(s, nodes) {
  for (const node of nodes) s.dom.elements.board.removeChild(node);
}
function posZIndex(pos, asWhite) {
  const minZ = 3;
  const rank = pos[1];
  const z = asWhite ? minZ + 7 - rank : minZ + rank;
  return `${z}`;
}
function computeSquareClasses(s) {
  var _a;
  const squares = new Map();
  if (s.lastMove && s.highlight.lastMove) for (const k of s.lastMove) {
    if ((0, _util.isKey)(k) && k !== 'a0') addSquare(squares, k, 'last-move');
  }
  if (s.check && s.highlight.check) for (const k of s.check) addSquare(squares, k, 'check');
  const selected = s.selectable.selected;
  if (selected) {
    if ((0, _util.isKey)(selected)) addSquare(squares, selected, 'selected');
    if (s.movable.showDests) {
      const dests = (_a = s.movable.dests) === null || _a === void 0 ? void 0 : _a.get((0, _util.isKey)(selected) ? selected : (0, _util.dropOrigOf)(selected.role));
      if (dests) for (const k of dests) {
        addSquare(squares, k, 'move-dest' + (s.boardState.pieces.has(k) ? ' oc' : ''));
      }
      const pDests = s.premovable.dests;
      if (pDests) for (const k of pDests) {
        addSquare(squares, k, 'premove-dest' + (s.boardState.pieces.has(k) ? ' oc' : ''));
      }
    }
  }
  const premove = s.premovable.current;
  if (premove) for (const k of premove) if ((0, _util.isKey)(k)) addSquare(squares, k, 'current-premove');
  const o = s.exploding;
  if (o) for (const k of o.keys) addSquare(squares, k, 'exploding' + o.stage);
  return squares;
}
function addSquare(squares, key, klass) {
  const classes = squares.get(key);
  if (classes) squares.set(key, `${classes} ${klass}`);else squares.set(key, klass);
}
function appendValue(map, key, value) {
  const arr = map.get(key);
  if (arr) arr.push(value);else map.set(key, [value]);
}

},{"./board.js":4,"./util.js":20}],16:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.defaults = defaults;
var fen = _interopRequireWildcard(require("./fen.js"));
var _util = require("./util.js");
var _premove = require("./premove.js");
var _predrop = require("./predrop.js");
var cg = _interopRequireWildcard(require("./types.js"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function defaults() {
  return {
    boardState: fen.read(fen.initial, {
      width: 8,
      height: 8
    }),
    orientation: 'white',
    turnColor: 'white',
    coordinates: true,
    ranksPosition: 'right',
    autoCastle: true,
    viewOnly: false,
    disableContextMenu: false,
    addPieceZIndex: false,
    blockTouchScroll: false,
    pieceKey: false,
    highlight: {
      lastMove: true,
      check: true
    },
    animation: {
      enabled: true,
      duration: 200
    },
    movable: {
      free: true,
      color: 'both',
      showDests: true,
      events: {},
      rookCastle: true
    },
    premovable: {
      enabled: true,
      premoveFunc: (0, _premove.premove)('chess', false, {
        width: 8,
        height: 8
      }),
      predropFunc: (0, _predrop.predrop)('chess', {
        width: 8,
        height: 8
      }),
      castle: true,
      events: {}
    },
    draggable: {
      enabled: true,
      distance: 3,
      autoDistance: true,
      showGhost: true,
      deleteOnDropOff: false
    },
    selectable: {
      enabled: true
    },
    stats: {
      // on touchscreen, default to "tap-tap" moves
      // instead of drag
      dragged: !('ontouchstart' in window)
    },
    events: {},
    drawable: {
      enabled: true,
      visible: true,
      defaultSnapToValidMove: true,
      eraseOnClick: true,
      shapes: [],
      autoShapes: [],
      brushes: {
        green: {
          key: 'g',
          color: '#15781B',
          opacity: 1,
          lineWidth: 10
        },
        red: {
          key: 'r',
          color: '#882020',
          opacity: 1,
          lineWidth: 10
        },
        blue: {
          key: 'b',
          color: '#003088',
          opacity: 1,
          lineWidth: 10
        },
        yellow: {
          key: 'y',
          color: '#e68f00',
          opacity: 1,
          lineWidth: 10
        },
        paleBlue: {
          key: 'pb',
          color: '#003088',
          opacity: 0.4,
          lineWidth: 15
        },
        paleGreen: {
          key: 'pg',
          color: '#15781B',
          opacity: 0.4,
          lineWidth: 15
        },
        paleRed: {
          key: 'pr',
          color: '#882020',
          opacity: 0.4,
          lineWidth: 15
        },
        paleGrey: {
          key: 'pgr',
          color: '#4a4a4a',
          opacity: 0.35,
          lineWidth: 15
        }
      },
      prevSvgHash: ''
    },
    hold: (0, _util.timer)(),
    dimensions: {
      width: 8,
      height: 8
    },
    notation: cg.Notation.ALGEBRAIC,
    kingRoles: ['k-piece']
  };
}

},{"./fen.js":11,"./predrop.js":13,"./premove.js":14,"./types.js":19,"./util.js":20}],17:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createElement = createElement;
exports.renderSvg = renderSvg;
exports.setAttributes = setAttributes;
var _util = require("./util.js");
var _sync = require("./sync.js");
function createElement(tagName) {
  return document.createElementNS('http://www.w3.org/2000/svg', tagName);
}
function renderSvg(state, svg, customSvg) {
  const d = state.drawable,
    curD = d.current,
    cur = curD && curD.mouseSq ? curD : undefined,
    arrowDests = new Map(),
    bounds = state.dom.bounds(),
    nonPieceAutoShapes = d.autoShapes.filter(autoShape => !autoShape.piece);
  for (const s of d.shapes.concat(nonPieceAutoShapes).concat(cur ? [cur] : [])) {
    if (s.dest) arrowDests.set(s.dest, (arrowDests.get(s.dest) || 0) + 1);
  }
  const shapes = d.shapes.concat(nonPieceAutoShapes).map(s => {
    return {
      shape: s,
      current: false,
      hash: shapeHash(s, arrowDests, false, bounds)
    };
  });
  if (cur) shapes.push({
    shape: cur,
    current: true,
    hash: shapeHash(cur, arrowDests, true, bounds)
  });
  const fullHash = shapes.map(sc => sc.hash).join(';');
  if (fullHash === state.drawable.prevSvgHash) return;
  state.drawable.prevSvgHash = fullHash;
  /*
    -- DOM hierarchy --
    <svg class="cg-shapes">      (<= svg)
      <defs>
        ...(for brushes)...
      </defs>
      <g>
        ...(for arrows and circles)...
      </g>
    </svg>
    <svg class="cg-custom-svgs"> (<= customSvg)
      <g>
        ...(for custom svgs)...
      </g>
    </svg>
  */
  const defsEl = svg.querySelector('defs');
  const shapesEl = svg.querySelector('g');
  const customSvgsEl = customSvg.querySelector('g');
  syncDefs(d, shapes, defsEl);
  (0, _sync.syncShapes)(shapes.filter(s => !s.shape.customSvg), shapesEl, shape => renderShape(state, shape, d.brushes, arrowDests, bounds));
  (0, _sync.syncShapes)(shapes.filter(s => s.shape.customSvg), customSvgsEl, shape => renderShape(state, shape, d.brushes, arrowDests, bounds));
}
// append only. Don't try to update/remove.
function syncDefs(d, shapes, defsEl) {
  const brushes = new Map();
  let brush;
  for (const s of shapes) {
    if (s.shape.dest) {
      brush = d.brushes[s.shape.brush];
      if (s.shape.modifiers) brush = makeCustomBrush(brush, s.shape.modifiers);
      brushes.set(brush.key, brush);
    }
  }
  const keysInDom = new Set();
  let el = defsEl.firstChild;
  while (el) {
    keysInDom.add(el.getAttribute('cgKey'));
    el = el.nextSibling;
  }
  for (const [key, brush] of brushes.entries()) {
    if (!keysInDom.has(key)) defsEl.appendChild(renderMarker(brush));
  }
}
function shapeHash({
  orig,
  dest,
  brush,
  piece,
  modifiers,
  customSvg
}, arrowDests, current, bounds) {
  return [bounds.width, bounds.height, current, orig, dest, brush, dest && (arrowDests.get(dest) || 0) > 1, piece && pieceHash(piece), modifiers && modifiersHash(modifiers), customSvg && customSvgHash(customSvg)].filter(x => x).join(',');
}
function pieceHash(piece) {
  return [piece.color, piece.role, piece.promoted, piece.scale].filter(x => x).join(',');
}
function modifiersHash(m) {
  return '' + (m.lineWidth || '');
}
function customSvgHash(s) {
  // Rolling hash with base 31 (cf. https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript)
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i) >>> 0;
  }
  return 'custom-' + h.toString();
}
function renderShape(state, {
  shape,
  current,
  hash
}, brushes, arrowDests, bounds) {
  let el;
  const orig = orient((0, _util.key2pos)(shape.orig), state.orientation, state.dimensions);
  if (shape.customSvg) {
    el = renderCustomSvg(shape.customSvg, orig, bounds, state.dimensions);
  } else {
    if (shape.dest) {
      let brush = brushes[shape.brush];
      if (shape.modifiers) brush = makeCustomBrush(brush, shape.modifiers);
      el = renderArrow(brush, orig, orient((0, _util.key2pos)(shape.dest), state.orientation, state.dimensions), current, (arrowDests.get(shape.dest) || 0) > 1, bounds, state.dimensions);
    } else el = renderCircle(brushes[shape.brush], orig, current, bounds, state.dimensions);
  }
  el.setAttribute('cgHash', hash);
  return el;
}
function renderCustomSvg(customSvg, pos, bounds, bd) {
  const [x, y] = pos2user(pos, bounds, bd);
  // Translate to top-left of `orig` square
  const g = setAttributes(createElement('g'), {
    transform: `translate(${x},${y})`
  });
  // Give 100x100 coordinate system to the user for `orig` square
  const svg = setAttributes(createElement('svg'), {
    width: 1,
    height: 1,
    viewBox: '0 0 100 100'
  });
  g.appendChild(svg);
  svg.innerHTML = customSvg;
  return g;
}
function renderCircle(brush, pos, current, bounds, bd) {
  const o = pos2user(pos, bounds, bd),
    widths = circleWidth(),
    radius = Math.min(bd.width / (2 * bd.height), bounds.width / bd.width / (2 * bounds.height / bd.height));
  return setAttributes(createElement('circle'), {
    stroke: brush.color,
    'stroke-width': widths[current ? 0 : 1],
    fill: 'none',
    opacity: opacity(brush, current),
    cx: o[0],
    cy: o[1],
    r: radius - widths[1] / 2
  });
}
function renderArrow(brush, orig, dest, current, shorten, bounds, bd) {
  const m = arrowMargin(shorten && !current),
    a = pos2user(orig, bounds, bd),
    b = pos2user(dest, bounds, bd),
    dx = b[0] - a[0],
    dy = b[1] - a[1],
    angle = Math.atan2(dy, dx),
    xo = Math.cos(angle) * m,
    yo = Math.sin(angle) * m;
  return setAttributes(createElement('line'), {
    stroke: brush.color,
    'stroke-width': lineWidth(brush, current),
    'stroke-linecap': 'round',
    'marker-end': 'url(#arrowhead-' + brush.key + ')',
    opacity: opacity(brush, current),
    x1: a[0],
    y1: a[1],
    x2: b[0] - xo,
    y2: b[1] - yo
  });
}
function renderMarker(brush) {
  const marker = setAttributes(createElement('marker'), {
    id: 'arrowhead-' + brush.key,
    orient: 'auto',
    markerWidth: 4,
    markerHeight: 8,
    refX: 2.05,
    refY: 2.01
  });
  marker.appendChild(setAttributes(createElement('path'), {
    d: 'M0,0 V4 L3,2 Z',
    fill: brush.color
  }));
  marker.setAttribute('cgKey', brush.key);
  return marker;
}
function setAttributes(el, attrs) {
  for (const key in attrs) {
    if (Object.prototype.hasOwnProperty.call(attrs, key)) el.setAttribute(key, attrs[key]);
  }
  return el;
}
function orient(pos, color, bd) {
  return color === 'white' ? pos : [bd.width - 1 - pos[0], bd.height - 1 - pos[1]];
}
function makeCustomBrush(base, modifiers) {
  return {
    color: base.color,
    opacity: Math.round(base.opacity * 10) / 10,
    lineWidth: Math.round(modifiers.lineWidth || base.lineWidth),
    key: [base.key, modifiers.lineWidth].filter(x => x).join('')
  };
}
function circleWidth() {
  return [3 / 64, 4 / 64];
}
function lineWidth(brush, current) {
  return (brush.lineWidth || 10) * (current ? 0.85 : 1) / 64;
}
function opacity(brush, current) {
  return (brush.opacity || 1) * (current ? 0.9 : 1);
}
function arrowMargin(shorten) {
  return (shorten ? 20 : 10) / 64;
}
function pos2user(pos, bounds, bd) {
  let xScale, yScale;
  // Janggi/Xiangqi board needs different calculation
  if (bd.width === 9 && bd.height === 10) {
    xScale = Math.max(1, bounds.width / bounds.height) * Math.min(1, bd.height / bd.width);
    yScale = Math.max(1, bounds.height / bounds.width) * (bd.width / bd.height);
  } else {
    xScale = Math.min(1, bounds.width / bounds.height) * Math.max(1, bd.height / bd.width);
    yScale = Math.min(1, bounds.height / bounds.width) * Math.max(1, bd.width / bd.height);
  }
  return [(pos[0] - (bd.width - 1) / 2) * xScale, ((bd.height - 1) / 2 - pos[1]) * yScale];
}

},{"./sync.js":18,"./util.js":20}],18:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.syncShapes = syncShapes;
// append and remove only. No updates.
function syncShapes(shapes, root, renderShape) {
  const hashesInDom = new Map(),
    // by hash
    toRemove = [];
  for (const sc of shapes) hashesInDom.set(sc.hash, false);
  let el = root.firstChild,
    elHash;
  while (el) {
    elHash = el.getAttribute('cgHash');
    // found a shape element that's here to stay
    if (hashesInDom.has(elHash)) hashesInDom.set(elHash, true);
    // or remove it
    else toRemove.push(el);
    el = el.nextSibling;
  }
  // remove old shapes
  for (const el of toRemove) root.removeChild(el);
  // insert shapes that are not yet in dom
  for (const sc of shapes) {
    if (!hashesInDom.get(sc.hash)) root.appendChild(renderShape(sc));
  }
}

},{}],19:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.sides = exports.ranks = exports.letters = exports.files = exports.colors = exports.Notation = void 0;
var Notation;
(function (Notation) {
  Notation[Notation["ALGEBRAIC"] = 0] = "ALGEBRAIC";
  Notation[Notation["SHOGI_ENGLET"] = 1] = "SHOGI_ENGLET";
  Notation[Notation["SHOGI_ARBNUM"] = 2] = "SHOGI_ARBNUM";
  Notation[Notation["SHOGI_HANNUM"] = 3] = "SHOGI_HANNUM";
  Notation[Notation["JANGGI"] = 4] = "JANGGI";
  Notation[Notation["XIANGQI_ARBNUM"] = 5] = "XIANGQI_ARBNUM";
  Notation[Notation["XIANGQI_HANNUM"] = 6] = "XIANGQI_HANNUM";
  Notation[Notation["THAI_ALGEBRAIC"] = 7] = "THAI_ALGEBRAIC";
})(Notation || (exports.Notation = Notation = {}));
const colors = exports.colors = ['white', 'black'];
const sides = exports.sides = ['ally', 'enemy'];
const files = exports.files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p'];
const ranks = exports.ranks = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';', '<', '=', '>', '?', '@'];
const letters = exports.letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];

},{}],20:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.allKeys = allKeys;
exports.allPos = allPos;
exports.changeNumber = changeNumber;
exports.computeSquareCenter = computeSquareCenter;
exports.distanceSq = exports.createEl = void 0;
exports.dropOrigOf = dropOrigOf;
exports.invRanks = exports.eventPosition = void 0;
exports.isDropOrig = isDropOrig;
exports.isKey = isKey;
exports.isMiniBoard = void 0;
exports.isPiece = isPiece;
exports.isRightButton = void 0;
exports.isSame = isSame;
exports.key2pos = void 0;
exports.letterOf = letterOf;
exports.memo = memo;
exports.posToTranslate = exports.pos2key = exports.pieceSide = exports.pieceClasses = exports.opposite = void 0;
exports.roleOf = roleOf;
exports.uciToMove = exports.translateAndScale = exports.translate = exports.timer = exports.setVisible = exports.samePiece = void 0;
var cg = _interopRequireWildcard(require("./types.js"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
const invRanks = exports.invRanks = [...cg.ranks].reverse();
function files(n) {
  return cg.files.slice(0, n);
}
function ranks(n) {
  return cg.ranks.slice(0, n);
}
function allKeys(bd) {
  return Array.prototype.concat(...files(bd.width).map(c => ranks(bd.height).map(r => c + r)));
}
function allPos(bd) {
  return allKeys(bd).map(key2pos);
}
const pos2key = pos => cg.files[pos[0]] + cg.ranks[pos[1]];
exports.pos2key = pos2key;
const key2pos = k => [k.charCodeAt(0) - 97, k.charCodeAt(1) - 49];
exports.key2pos = key2pos;
function roleOf(letter) {
  return letter.replace('+', 'p').replace('*', '_').replace('@', '').toLowerCase() + '-piece';
}
function letterOf(role, uppercase = false) {
  const letterPart = role.slice(0, role.indexOf('-'));
  const letter = (letterPart.length > 1 ? letterPart.replace('p', '+') : letterPart).replace('_', '*');
  return uppercase ? letter.toUpperCase() : letter;
}
function dropOrigOf(role) {
  return letterOf(role, true) + '@';
}
function isDropOrig(orig) {
  return orig[0] === orig[0].toUpperCase();
}
function isKey(selectable) {
  return typeof selectable === 'string' && selectable[0] === selectable[0].toLowerCase();
}
function isPiece(selectable) {
  return typeof selectable !== 'string';
}
function isSame(lhs, rhs) {
  if (isPiece(lhs) && isPiece(rhs)) return samePiece(lhs, rhs);else return lhs === rhs;
}
function changeNumber(map, key, num) {
  var _a;
  map.set(key, ((_a = map.get(key)) !== null && _a !== void 0 ? _a : 0) + num);
}
// TODO cover two-digit numbers
// This function isn't used anywhere inside chessground btw, it's probably used in Lichess
// Pychess has this in chess.ts
const uciToMove = uci => {
  if (!uci) return undefined;
  if (uci[1] === '@') return [uci.slice(2, 4)];
  return [uci.slice(0, 2), uci.slice(2, 4)];
};
exports.uciToMove = uciToMove;
function memo(f) {
  let v;
  const ret = () => {
    if (v === undefined) v = f();
    return v;
  };
  ret.clear = () => {
    v = undefined;
  };
  return ret;
}
const timer = () => {
  let startAt;
  return {
    start() {
      startAt = performance.now();
    },
    cancel() {
      startAt = undefined;
    },
    stop() {
      if (!startAt) return 0;
      const time = performance.now() - startAt;
      startAt = undefined;
      return time;
    }
  };
};
exports.timer = timer;
const opposite = c => c === 'white' ? 'black' : 'white';
exports.opposite = opposite;
const samePiece = (p1, p2) => p1.role === p2.role && p1.color === p2.color && !!p1.promoted === !!p2.promoted;
exports.samePiece = samePiece;
const pieceSide = (p, o) => p.color === o ? 'ally' : 'enemy';
exports.pieceSide = pieceSide;
const pieceClasses = (p, o) => `${p.color} ${pieceSide(p, o)} ${p.mirror ? 'mirror' : ''} ${p.promoted ? 'promoted ' : ''}${p.role}`;
exports.pieceClasses = pieceClasses;
const distanceSq = (pos1, pos2) => {
  const dx = pos1[0] - pos2[0],
    dy = pos1[1] - pos2[1];
  return dx * dx + dy * dy;
};
exports.distanceSq = distanceSq;
const posToTranslate = (bounds, bd) => (pos, asWhite) => [(asWhite ? pos[0] : bd.width - 1 - pos[0]) * bounds.width / bd.width, (asWhite ? bd.height - 1 - pos[1] : pos[1]) * bounds.height / bd.height];
exports.posToTranslate = posToTranslate;
const translate = (el, pos) => {
  el.style.transform = `translate(${pos[0]}px,${pos[1]}px)`;
};
exports.translate = translate;
const translateAndScale = (el, pos, scale = 1) => {
  el.style.transform = `translate(${pos[0]}px,${pos[1]}px) scale(${scale})`;
};
exports.translateAndScale = translateAndScale;
const setVisible = (el, v) => {
  el.style.visibility = v ? 'visible' : 'hidden';
};
exports.setVisible = setVisible;
const eventPosition = e => {
  var _a;
  if (e.clientX || e.clientX === 0) return [e.clientX, e.clientY];
  if ((_a = e.targetTouches) === null || _a === void 0 ? void 0 : _a[0]) return [e.targetTouches[0].clientX, e.targetTouches[0].clientY];
  return; // touchend has no position!
};
exports.eventPosition = eventPosition;
const isRightButton = e => e.buttons === 2 || e.button === 2;
exports.isRightButton = isRightButton;
const createEl = (tagName, className) => {
  const el = document.createElement(tagName);
  if (className) el.className = className;
  return el;
};
exports.createEl = createEl;
const isMiniBoard = el => {
  return Array.from(el.classList).includes('mini');
};
exports.isMiniBoard = isMiniBoard;
function computeSquareCenter(key, asWhite, bounds, bd) {
  const pos = key2pos(key);
  if (!asWhite) {
    pos[0] = bd.width - 1 - pos[0];
    pos[1] = bd.height - 1 - pos[1];
  }
  return [bounds.left + bounds.width * (pos[0] + 0.5) / bd.width, bounds.top + bounds.height * (bd.height - pos[1] - 0.5) / bd.height];
}

},{"./types.js":19}],21:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.renderWrap = renderWrap;
var _util = require("./util.js");
var _types = require("./types.js");
var _svg = require("./svg.js");
// Need to support up to 16 ranks or files
// Since some countries never had variants that big, some letters and numbers here are theoretical
const LETTER_ENGLISH = _types.letters;
const LETTER_THAI = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ', 'ช', 'ญ', 'ต', 'ถ', 'ท', 'น', 'ป', 'ผ', 'พ', 'ม'];
const NUMBER_ARABIC = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16'];
const NUMBER_JANGGI = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '1', '2', '3', '4', '5', '6'];
const NUMBER_HANZI = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六'];
const NUMBER_THAI = ['๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙', '๑๐', '๑๑', '๑๒', '๑๓', '๑๔', '๑๕', '๑๖'];
const coordFormat = {
  [_types.Notation.ALGEBRAIC]: [{
    coords: LETTER_ENGLISH,
    position: 'bottom',
    direction: 'forward'
  }, {
    coords: NUMBER_ARABIC,
    position: 'side',
    direction: 'forward'
  }],
  [_types.Notation.SHOGI_ENGLET]: [{
    coords: NUMBER_ARABIC,
    position: 'top',
    direction: 'backward'
  }, {
    coords: LETTER_ENGLISH,
    position: 'side',
    direction: 'backward'
  }],
  [_types.Notation.SHOGI_ARBNUM]: [{
    coords: NUMBER_ARABIC,
    position: 'top',
    direction: 'backward'
  }, {
    coords: NUMBER_ARABIC,
    position: 'side',
    direction: 'backward'
  }],
  [_types.Notation.SHOGI_HANNUM]: [{
    coords: NUMBER_ARABIC,
    position: 'top',
    direction: 'backward'
  }, {
    coords: NUMBER_HANZI,
    position: 'side',
    direction: 'backward'
  }],
  [_types.Notation.JANGGI]: [{
    coords: NUMBER_ARABIC,
    position: 'bottom',
    direction: 'forward'
  }, {
    coords: NUMBER_JANGGI,
    position: 'side',
    direction: 'backward'
  }],
  [_types.Notation.XIANGQI_ARBNUM]: [{
    coords: NUMBER_ARABIC,
    position: 'top',
    direction: 'forward',
    noBlackReverse: true
  }, {
    coords: NUMBER_ARABIC,
    position: 'bottom',
    direction: 'backward',
    noBlackReverse: true
  }],
  [_types.Notation.XIANGQI_HANNUM]: [{
    coords: NUMBER_ARABIC,
    position: 'top',
    direction: 'forward',
    noBlackReverse: true
  }, {
    coords: NUMBER_HANZI,
    position: 'bottom',
    direction: 'backward',
    noBlackReverse: true
  }],
  [_types.Notation.THAI_ALGEBRAIC]: [{
    coords: LETTER_THAI,
    position: 'bottom',
    direction: 'forward'
  }, {
    coords: NUMBER_THAI,
    position: 'side',
    direction: 'forward'
  }]
};
function renderWrap(element, s) {
  // .cg-wrap (element passed to Chessground)
  //   cg-container
  //     cg-board
  //     svg.cg-shapes
  //       defs
  //       g
  //     svg.cg-custom-svgs
  //       g
  //     cg-auto-pieces
  //     coords.ranks
  //     coords.files
  //     piece.ghost
  element.innerHTML = '';
  // ensure the cg-wrap class is set
  // so bounds calculation can use the CSS width/height values
  // add that class yourself to the element before calling chessground
  // for a slight performance improvement! (avoids recomputing style)
  element.classList.add('cg-wrap');
  for (const c of _types.colors) element.classList.toggle('orientation-' + c, s.orientation === c);
  element.classList.toggle('manipulable', !s.viewOnly);
  const container = (0, _util.createEl)('cg-container');
  element.appendChild(container);
  const extension = (0, _util.createEl)('extension');
  container.appendChild(extension);
  const board = (0, _util.createEl)('cg-board');
  container.appendChild(board);
  let pocketBottom, pocketTop;
  if ((0, _util.isMiniBoard)(element)) {
    if (s.boardState.pockets) {
      pocketBottom = (0, _util.createEl)('pocketBottom');
      pocketTop = (0, _util.createEl)('pocketTop');
      container.insertBefore(s.orientation === 'white' ? pocketTop : pocketBottom, board);
      container.insertBefore(s.orientation === 'white' ? pocketBottom : pocketTop, board.nextSibling);
    }
  }
  let svg;
  let customSvg;
  let autoPieces;
  if (s.drawable.visible) {
    const width = s.dimensions.width;
    const height = s.dimensions.height;
    svg = (0, _svg.setAttributes)((0, _svg.createElement)('svg'), {
      class: 'cg-shapes',
      viewBox: `${-width / 2} ${-height / 2} ${width} ${height}`,
      preserveAspectRatio: 'xMidYMid slice'
    });
    svg.appendChild((0, _svg.createElement)('defs'));
    svg.appendChild((0, _svg.createElement)('g'));
    customSvg = (0, _svg.setAttributes)((0, _svg.createElement)('svg'), {
      class: 'cg-custom-svgs',
      viewBox: `${-(width - 1) / 2} ${-(height - 1) / 2} ${width} ${height}`,
      preserveAspectRatio: 'xMidYMid slice'
    });
    customSvg.appendChild((0, _svg.createElement)('g'));
    autoPieces = (0, _util.createEl)('cg-auto-pieces');
    container.appendChild(svg);
    container.appendChild(customSvg);
    container.appendChild(autoPieces);
  }
  if (s.coordinates) {
    coordFormat[s.notation].forEach(f => {
      const max = f.position === 'side' ? s.dimensions.height : s.dimensions.width;
      const pos = f.position; // TODO pos = f.position === 'side' ? s.ranksPosition : f.position;
      const coords = f.coords.slice(0, max);
      container.appendChild(renderCoords(coords, `${pos} ${f.direction}${f.noBlackReverse ? '' : ' ' + s.orientation}`));
    });
  }
  let ghost;
  if (s.draggable.enabled && s.draggable.showGhost) {
    ghost = (0, _util.createEl)('piece', 'ghost');
    (0, _util.setVisible)(ghost, false);
    container.appendChild(ghost);
  }
  return {
    pocketTop,
    pocketBottom,
    board,
    container,
    wrap: element,
    ghost,
    svg,
    customSvg,
    autoPieces
  };
}
function renderCoords(elems, className) {
  const el = (0, _util.createEl)('coords', className);
  let f;
  for (const elem of elems) {
    f = (0, _util.createEl)('coord');
    f.textContent = elem;
    el.appendChild(f);
  }
  return el;
}

},{"./svg.js":17,"./types.js":19,"./util.js":20}],22:[function(require,module,exports){
(function (process){(function (){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var Module = function () {
  var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;
  return function (Module) {
    Module = Module || {};
    var Module = typeof Module !== "undefined" ? Module : {};
    var readyPromiseResolve, readyPromiseReject;
    Module["ready"] = new Promise(function (resolve, reject) {
      readyPromiseResolve = resolve;
      readyPromiseReject = reject;
    });
    var moduleOverrides = {};
    var key;
    for (key in Module) {
      if (Module.hasOwnProperty(key)) {
        moduleOverrides[key] = Module[key];
      }
    }
    var arguments_ = [];
    var thisProgram = "./this.program";
    var quit_ = function (status, toThrow) {
      throw toThrow;
    };
    var ENVIRONMENT_IS_WEB = false;
    var ENVIRONMENT_IS_WORKER = false;
    var ENVIRONMENT_IS_NODE = false;
    var ENVIRONMENT_IS_SHELL = false;
    ENVIRONMENT_IS_WEB = typeof window === "object";
    ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
    ENVIRONMENT_IS_NODE = typeof process === "object" && typeof process.versions === "object" && typeof process.versions.node === "string";
    ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
    var scriptDirectory = "";
    function locateFile(path) {
      if (Module["locateFile"]) {
        return Module["locateFile"](path, scriptDirectory);
      }
      return scriptDirectory + path;
    }
    var read_, readAsync, readBinary, setWindowTitle;
    if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
      if (ENVIRONMENT_IS_WORKER) {
        scriptDirectory = self.location.href;
      } else if (document.currentScript) {
        scriptDirectory = document.currentScript.src;
      }
      if (_scriptDir) {
        scriptDirectory = _scriptDir;
      }
      if (scriptDirectory.indexOf("blob:") !== 0) {
        scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf("/") + 1);
      } else {
        scriptDirectory = "";
      }
      {
        read_ = function shell_read(url) {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", url, false);
          xhr.send(null);
          return xhr.responseText;
        };
        if (ENVIRONMENT_IS_WORKER) {
          readBinary = function readBinary(url) {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, false);
            xhr.responseType = "arraybuffer";
            xhr.send(null);
            return new Uint8Array(xhr.response);
          };
        }
        readAsync = function readAsync(url, onload, onerror) {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", url, true);
          xhr.responseType = "arraybuffer";
          xhr.onload = function xhr_onload() {
            if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
              onload(xhr.response);
              return;
            }
            onerror();
          };
          xhr.onerror = onerror;
          xhr.send(null);
        };
      }
      setWindowTitle = function (title) {
        document.title = title;
      };
    } else {}
    var out = Module["print"] || console.log.bind(console);
    var err = Module["printErr"] || console.warn.bind(console);
    for (key in moduleOverrides) {
      if (moduleOverrides.hasOwnProperty(key)) {
        Module[key] = moduleOverrides[key];
      }
    }
    moduleOverrides = null;
    if (Module["arguments"]) arguments_ = Module["arguments"];
    if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
    if (Module["quit"]) quit_ = Module["quit"];
    var tempRet0 = 0;
    var setTempRet0 = function (value) {
      tempRet0 = value;
    };
    var wasmBinary;
    if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
    var noExitRuntime;
    if (Module["noExitRuntime"]) noExitRuntime = Module["noExitRuntime"];
    if (typeof WebAssembly !== "object") {
      err("no native wasm support detected");
    }
    var wasmMemory;
    var wasmTable = new WebAssembly.Table({
      "initial": 605,
      "maximum": 605 + 0,
      "element": "anyfunc"
    });
    var ABORT = false;
    var EXITSTATUS = 0;
    function assert(condition, text) {
      if (!condition) {
        abort("Assertion failed: " + text);
      }
    }
    var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;
    function UTF8ArrayToString(heap, idx, maxBytesToRead) {
      var endIdx = idx + maxBytesToRead;
      var endPtr = idx;
      while (heap[endPtr] && !(endPtr >= endIdx)) ++endPtr;
      if (endPtr - idx > 16 && heap.subarray && UTF8Decoder) {
        return UTF8Decoder.decode(heap.subarray(idx, endPtr));
      } else {
        var str = "";
        while (idx < endPtr) {
          var u0 = heap[idx++];
          if (!(u0 & 128)) {
            str += String.fromCharCode(u0);
            continue;
          }
          var u1 = heap[idx++] & 63;
          if ((u0 & 224) == 192) {
            str += String.fromCharCode((u0 & 31) << 6 | u1);
            continue;
          }
          var u2 = heap[idx++] & 63;
          if ((u0 & 240) == 224) {
            u0 = (u0 & 15) << 12 | u1 << 6 | u2;
          } else {
            u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heap[idx++] & 63;
          }
          if (u0 < 65536) {
            str += String.fromCharCode(u0);
          } else {
            var ch = u0 - 65536;
            str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
          }
        }
      }
      return str;
    }
    function UTF8ToString(ptr, maxBytesToRead) {
      return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
    }
    function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
      if (!(maxBytesToWrite > 0)) return 0;
      var startIdx = outIdx;
      var endIdx = outIdx + maxBytesToWrite - 1;
      for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343) {
          var u1 = str.charCodeAt(++i);
          u = 65536 + ((u & 1023) << 10) | u1 & 1023;
        }
        if (u <= 127) {
          if (outIdx >= endIdx) break;
          heap[outIdx++] = u;
        } else if (u <= 2047) {
          if (outIdx + 1 >= endIdx) break;
          heap[outIdx++] = 192 | u >> 6;
          heap[outIdx++] = 128 | u & 63;
        } else if (u <= 65535) {
          if (outIdx + 2 >= endIdx) break;
          heap[outIdx++] = 224 | u >> 12;
          heap[outIdx++] = 128 | u >> 6 & 63;
          heap[outIdx++] = 128 | u & 63;
        } else {
          if (outIdx + 3 >= endIdx) break;
          heap[outIdx++] = 240 | u >> 18;
          heap[outIdx++] = 128 | u >> 12 & 63;
          heap[outIdx++] = 128 | u >> 6 & 63;
          heap[outIdx++] = 128 | u & 63;
        }
      }
      heap[outIdx] = 0;
      return outIdx - startIdx;
    }
    function stringToUTF8(str, outPtr, maxBytesToWrite) {
      return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
    }
    function lengthBytesUTF8(str) {
      var len = 0;
      for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
        if (u <= 127) ++len;else if (u <= 2047) len += 2;else if (u <= 65535) len += 3;else len += 4;
      }
      return len;
    }
    var UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;
    function UTF16ToString(ptr, maxBytesToRead) {
      var endPtr = ptr;
      var idx = endPtr >> 1;
      var maxIdx = idx + maxBytesToRead / 2;
      while (!(idx >= maxIdx) && HEAPU16[idx]) ++idx;
      endPtr = idx << 1;
      if (endPtr - ptr > 32 && UTF16Decoder) {
        return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
      } else {
        var i = 0;
        var str = "";
        while (1) {
          var codeUnit = HEAP16[ptr + i * 2 >> 1];
          if (codeUnit == 0 || i == maxBytesToRead / 2) return str;
          ++i;
          str += String.fromCharCode(codeUnit);
        }
      }
    }
    function stringToUTF16(str, outPtr, maxBytesToWrite) {
      if (maxBytesToWrite === undefined) {
        maxBytesToWrite = 2147483647;
      }
      if (maxBytesToWrite < 2) return 0;
      maxBytesToWrite -= 2;
      var startPtr = outPtr;
      var numCharsToWrite = maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
      for (var i = 0; i < numCharsToWrite; ++i) {
        var codeUnit = str.charCodeAt(i);
        HEAP16[outPtr >> 1] = codeUnit;
        outPtr += 2;
      }
      HEAP16[outPtr >> 1] = 0;
      return outPtr - startPtr;
    }
    function lengthBytesUTF16(str) {
      return str.length * 2;
    }
    function UTF32ToString(ptr, maxBytesToRead) {
      var i = 0;
      var str = "";
      while (!(i >= maxBytesToRead / 4)) {
        var utf32 = HEAP32[ptr + i * 4 >> 2];
        if (utf32 == 0) break;
        ++i;
        if (utf32 >= 65536) {
          var ch = utf32 - 65536;
          str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
        } else {
          str += String.fromCharCode(utf32);
        }
      }
      return str;
    }
    function stringToUTF32(str, outPtr, maxBytesToWrite) {
      if (maxBytesToWrite === undefined) {
        maxBytesToWrite = 2147483647;
      }
      if (maxBytesToWrite < 4) return 0;
      var startPtr = outPtr;
      var endPtr = startPtr + maxBytesToWrite - 4;
      for (var i = 0; i < str.length; ++i) {
        var codeUnit = str.charCodeAt(i);
        if (codeUnit >= 55296 && codeUnit <= 57343) {
          var trailSurrogate = str.charCodeAt(++i);
          codeUnit = 65536 + ((codeUnit & 1023) << 10) | trailSurrogate & 1023;
        }
        HEAP32[outPtr >> 2] = codeUnit;
        outPtr += 4;
        if (outPtr + 4 > endPtr) break;
      }
      HEAP32[outPtr >> 2] = 0;
      return outPtr - startPtr;
    }
    function lengthBytesUTF32(str) {
      var len = 0;
      for (var i = 0; i < str.length; ++i) {
        var codeUnit = str.charCodeAt(i);
        if (codeUnit >= 55296 && codeUnit <= 57343) ++i;
        len += 4;
      }
      return len;
    }
    function writeArrayToMemory(array, buffer) {
      HEAP8.set(array, buffer);
    }
    function writeAsciiToMemory(str, buffer, dontAddNull) {
      for (var i = 0; i < str.length; ++i) {
        HEAP8[buffer++ >> 0] = str.charCodeAt(i);
      }
      if (!dontAddNull) HEAP8[buffer >> 0] = 0;
    }
    var WASM_PAGE_SIZE = 65536;
    function alignUp(x, multiple) {
      if (x % multiple > 0) {
        x += multiple - x % multiple;
      }
      return x;
    }
    var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
    function updateGlobalBufferAndViews(buf) {
      buffer = buf;
      Module["HEAP8"] = HEAP8 = new Int8Array(buf);
      Module["HEAP16"] = HEAP16 = new Int16Array(buf);
      Module["HEAP32"] = HEAP32 = new Int32Array(buf);
      Module["HEAPU8"] = HEAPU8 = new Uint8Array(buf);
      Module["HEAPU16"] = HEAPU16 = new Uint16Array(buf);
      Module["HEAPU32"] = HEAPU32 = new Uint32Array(buf);
      Module["HEAPF32"] = HEAPF32 = new Float32Array(buf);
      Module["HEAPF64"] = HEAPF64 = new Float64Array(buf);
    }
    var DYNAMIC_BASE = 32363968,
      DYNAMICTOP_PTR = 27120928;
    var INITIAL_INITIAL_MEMORY = Module["INITIAL_MEMORY"] || 33554432;
    if (Module["wasmMemory"]) {
      wasmMemory = Module["wasmMemory"];
    } else {
      wasmMemory = new WebAssembly.Memory({
        "initial": INITIAL_INITIAL_MEMORY / WASM_PAGE_SIZE,
        "maximum": 1073741824 / WASM_PAGE_SIZE
      });
    }
    if (wasmMemory) {
      buffer = wasmMemory.buffer;
    }
    INITIAL_INITIAL_MEMORY = buffer.byteLength;
    updateGlobalBufferAndViews(buffer);
    HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;
    function callRuntimeCallbacks(callbacks) {
      while (callbacks.length > 0) {
        var callback = callbacks.shift();
        if (typeof callback == "function") {
          callback(Module);
          continue;
        }
        var func = callback.func;
        if (typeof func === "number") {
          if (callback.arg === undefined) {
            Module["dynCall_v"](func);
          } else {
            Module["dynCall_vi"](func, callback.arg);
          }
        } else {
          func(callback.arg === undefined ? null : callback.arg);
        }
      }
    }
    var __ATPRERUN__ = [];
    var __ATINIT__ = [];
    var __ATMAIN__ = [];
    var __ATPOSTRUN__ = [];
    var runtimeInitialized = false;
    var runtimeExited = false;
    function preRun() {
      if (Module["preRun"]) {
        if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
        while (Module["preRun"].length) {
          addOnPreRun(Module["preRun"].shift());
        }
      }
      callRuntimeCallbacks(__ATPRERUN__);
    }
    function initRuntime() {
      runtimeInitialized = true;
      if (!Module["noFSInit"] && !FS.init.initialized) FS.init();
      TTY.init();
      callRuntimeCallbacks(__ATINIT__);
    }
    function preMain() {
      FS.ignorePermissions = false;
      callRuntimeCallbacks(__ATMAIN__);
    }
    function exitRuntime() {
      runtimeExited = true;
    }
    function postRun() {
      if (Module["postRun"]) {
        if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
        while (Module["postRun"].length) {
          addOnPostRun(Module["postRun"].shift());
        }
      }
      callRuntimeCallbacks(__ATPOSTRUN__);
    }
    function addOnPreRun(cb) {
      __ATPRERUN__.unshift(cb);
    }
    function addOnPostRun(cb) {
      __ATPOSTRUN__.unshift(cb);
    }
    var Math_abs = Math.abs;
    var Math_ceil = Math.ceil;
    var Math_floor = Math.floor;
    var Math_min = Math.min;
    var runDependencies = 0;
    var runDependencyWatcher = null;
    var dependenciesFulfilled = null;
    function getUniqueRunDependency(id) {
      return id;
    }
    function addRunDependency(id) {
      runDependencies++;
      if (Module["monitorRunDependencies"]) {
        Module["monitorRunDependencies"](runDependencies);
      }
    }
    function removeRunDependency(id) {
      runDependencies--;
      if (Module["monitorRunDependencies"]) {
        Module["monitorRunDependencies"](runDependencies);
      }
      if (runDependencies == 0) {
        if (runDependencyWatcher !== null) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
        }
        if (dependenciesFulfilled) {
          var callback = dependenciesFulfilled;
          dependenciesFulfilled = null;
          callback();
        }
      }
    }
    Module["preloadedImages"] = {};
    Module["preloadedAudios"] = {};
    function abort(what) {
      if (Module["onAbort"]) {
        Module["onAbort"](what);
      }
      what += "";
      out(what);
      err(what);
      ABORT = true;
      EXITSTATUS = 1;
      what = "abort(" + what + "). Build with -s ASSERTIONS=1 for more info.";
      throw new WebAssembly.RuntimeError(what);
    }
    function hasPrefix(str, prefix) {
      return String.prototype.startsWith ? str.startsWith(prefix) : str.indexOf(prefix) === 0;
    }
    var dataURIPrefix = "data:application/octet-stream;base64,";
    function isDataURI(filename) {
      return hasPrefix(filename, dataURIPrefix);
    }
    var wasmBinaryFile = "ffish.wasm";
    if (!isDataURI(wasmBinaryFile)) {
      wasmBinaryFile = locateFile(wasmBinaryFile);
    }
    function getBinary() {
      try {
        if (wasmBinary) {
          return new Uint8Array(wasmBinary);
        }
        if (readBinary) {
          return readBinary(wasmBinaryFile);
        } else {
          throw "both async and sync fetching of the wasm failed";
        }
      } catch (err) {
        abort(err);
      }
    }
    function getBinaryPromise() {
      if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === "function") {
        return fetch(wasmBinaryFile, {
          credentials: "same-origin"
        }).then(function (response) {
          if (!response["ok"]) {
            throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
          }
          return response["arrayBuffer"]();
        }).catch(function () {
          return getBinary();
        });
      }
      return new Promise(function (resolve, reject) {
        resolve(getBinary());
      });
    }
    function createWasm() {
      var info = {
        "a": asmLibraryArg
      };
      function receiveInstance(instance, module) {
        var exports = instance.exports;
        Module["asm"] = exports;
        removeRunDependency("wasm-instantiate");
      }
      addRunDependency("wasm-instantiate");
      function receiveInstantiatedSource(output) {
        receiveInstance(output["instance"]);
      }
      function instantiateArrayBuffer(receiver) {
        return getBinaryPromise().then(function (binary) {
          return WebAssembly.instantiate(binary, info);
        }).then(receiver, function (reason) {
          err("failed to asynchronously prepare wasm: " + reason);
          abort(reason);
        });
      }
      function instantiateAsync() {
        if (!wasmBinary && typeof WebAssembly.instantiateStreaming === "function" && !isDataURI(wasmBinaryFile) && typeof fetch === "function") {
          fetch(wasmBinaryFile, {
            credentials: "same-origin"
          }).then(function (response) {
            var result = WebAssembly.instantiateStreaming(response, info);
            return result.then(receiveInstantiatedSource, function (reason) {
              err("wasm streaming compile failed: " + reason);
              err("falling back to ArrayBuffer instantiation");
              instantiateArrayBuffer(receiveInstantiatedSource);
            });
          });
        } else {
          return instantiateArrayBuffer(receiveInstantiatedSource);
        }
      }
      if (Module["instantiateWasm"]) {
        try {
          var exports = Module["instantiateWasm"](info, receiveInstance);
          return exports;
        } catch (e) {
          err("Module.instantiateWasm callback failed with error: " + e);
          return false;
        }
      }
      instantiateAsync();
      return {};
    }
    var tempDouble;
    var tempI64;
    __ATINIT__.push({
      func: function () {
        ___wasm_call_ctors();
      }
    });
    function demangle(func) {
      return func;
    }
    function demangleAll(text) {
      var regex = /\b_Z[\w\d_]+/g;
      return text.replace(regex, function (x) {
        var y = demangle(x);
        return x === y ? x : y + " [" + x + "]";
      });
    }
    function jsStackTrace() {
      var err = new Error();
      if (!err.stack) {
        try {
          throw new Error();
        } catch (e) {
          err = e;
        }
        if (!err.stack) {
          return "(no stack trace available)";
        }
      }
      return err.stack.toString();
    }
    function stackTrace() {
      var js = jsStackTrace();
      if (Module["extraStackTrace"]) js += "\n" + Module["extraStackTrace"]();
      return demangleAll(js);
    }
    function ___cxa_allocate_exception(size) {
      return _malloc(size);
    }
    var ___exception_infos = {};
    var ___exception_last = 0;
    function __ZSt18uncaught_exceptionv() {
      return __ZSt18uncaught_exceptionv.uncaught_exceptions > 0;
    }
    function ___cxa_throw(ptr, type, destructor) {
      ___exception_infos[ptr] = {
        ptr: ptr,
        adjusted: [ptr],
        type: type,
        destructor: destructor,
        refcount: 0,
        caught: false,
        rethrown: false
      };
      ___exception_last = ptr;
      if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
        __ZSt18uncaught_exceptionv.uncaught_exceptions = 1;
      } else {
        __ZSt18uncaught_exceptionv.uncaught_exceptions++;
      }
      throw ptr;
    }
    function setErrNo(value) {
      HEAP32[___errno_location() >> 2] = value;
      return value;
    }
    function ___map_file(pathname, size) {
      setErrNo(63);
      return -1;
    }
    var PATH = {
      splitPath: function (filename) {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1);
      },
      normalizeArray: function (parts, allowAboveRoot) {
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
          var last = parts[i];
          if (last === ".") {
            parts.splice(i, 1);
          } else if (last === "..") {
            parts.splice(i, 1);
            up++;
          } else if (up) {
            parts.splice(i, 1);
            up--;
          }
        }
        if (allowAboveRoot) {
          for (; up; up--) {
            parts.unshift("..");
          }
        }
        return parts;
      },
      normalize: function (path) {
        var isAbsolute = path.charAt(0) === "/",
          trailingSlash = path.substr(-1) === "/";
        path = PATH.normalizeArray(path.split("/").filter(function (p) {
          return !!p;
        }), !isAbsolute).join("/");
        if (!path && !isAbsolute) {
          path = ".";
        }
        if (path && trailingSlash) {
          path += "/";
        }
        return (isAbsolute ? "/" : "") + path;
      },
      dirname: function (path) {
        var result = PATH.splitPath(path),
          root = result[0],
          dir = result[1];
        if (!root && !dir) {
          return ".";
        }
        if (dir) {
          dir = dir.substr(0, dir.length - 1);
        }
        return root + dir;
      },
      basename: function (path) {
        if (path === "/") return "/";
        var lastSlash = path.lastIndexOf("/");
        if (lastSlash === -1) return path;
        return path.substr(lastSlash + 1);
      },
      extname: function (path) {
        return PATH.splitPath(path)[3];
      },
      join: function () {
        var paths = Array.prototype.slice.call(arguments, 0);
        return PATH.normalize(paths.join("/"));
      },
      join2: function (l, r) {
        return PATH.normalize(l + "/" + r);
      }
    };
    var PATH_FS = {
      resolve: function () {
        var resolvedPath = "",
          resolvedAbsolute = false;
        for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
          var path = i >= 0 ? arguments[i] : FS.cwd();
          if (typeof path !== "string") {
            throw new TypeError("Arguments to path.resolve must be strings");
          } else if (!path) {
            return "";
          }
          resolvedPath = path + "/" + resolvedPath;
          resolvedAbsolute = path.charAt(0) === "/";
        }
        resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(function (p) {
          return !!p;
        }), !resolvedAbsolute).join("/");
        return (resolvedAbsolute ? "/" : "") + resolvedPath || ".";
      },
      relative: function (from, to) {
        from = PATH_FS.resolve(from).substr(1);
        to = PATH_FS.resolve(to).substr(1);
        function trim(arr) {
          var start = 0;
          for (; start < arr.length; start++) {
            if (arr[start] !== "") break;
          }
          var end = arr.length - 1;
          for (; end >= 0; end--) {
            if (arr[end] !== "") break;
          }
          if (start > end) return [];
          return arr.slice(start, end - start + 1);
        }
        var fromParts = trim(from.split("/"));
        var toParts = trim(to.split("/"));
        var length = Math.min(fromParts.length, toParts.length);
        var samePartsLength = length;
        for (var i = 0; i < length; i++) {
          if (fromParts[i] !== toParts[i]) {
            samePartsLength = i;
            break;
          }
        }
        var outputParts = [];
        for (var i = samePartsLength; i < fromParts.length; i++) {
          outputParts.push("..");
        }
        outputParts = outputParts.concat(toParts.slice(samePartsLength));
        return outputParts.join("/");
      }
    };
    var TTY = {
      ttys: [],
      init: function () {},
      shutdown: function () {},
      register: function (dev, ops) {
        TTY.ttys[dev] = {
          input: [],
          output: [],
          ops: ops
        };
        FS.registerDevice(dev, TTY.stream_ops);
      },
      stream_ops: {
        open: function (stream) {
          var tty = TTY.ttys[stream.node.rdev];
          if (!tty) {
            throw new FS.ErrnoError(43);
          }
          stream.tty = tty;
          stream.seekable = false;
        },
        close: function (stream) {
          stream.tty.ops.flush(stream.tty);
        },
        flush: function (stream) {
          stream.tty.ops.flush(stream.tty);
        },
        read: function (stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(60);
          }
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = stream.tty.ops.get_char(stream.tty);
            } catch (e) {
              throw new FS.ErrnoError(29);
            }
            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(6);
            }
            if (result === null || result === undefined) break;
            bytesRead++;
            buffer[offset + i] = result;
          }
          if (bytesRead) {
            stream.node.timestamp = Date.now();
          }
          return bytesRead;
        },
        write: function (stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(60);
          }
          try {
            for (var i = 0; i < length; i++) {
              stream.tty.ops.put_char(stream.tty, buffer[offset + i]);
            }
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
          if (length) {
            stream.node.timestamp = Date.now();
          }
          return i;
        }
      },
      default_tty_ops: {
        get_char: function (tty) {
          if (!tty.input.length) {
            var result = null;
            if (typeof window != "undefined" && typeof window.prompt == "function") {
              result = window.prompt("Input: ");
              if (result !== null) {
                result += "\n";
              }
            } else if (typeof readline == "function") {
              result = readline();
              if (result !== null) {
                result += "\n";
              }
            }
            if (!result) {
              return null;
            }
            tty.input = intArrayFromString(result, true);
          }
          return tty.input.shift();
        },
        put_char: function (tty, val) {
          if (val === null || val === 10) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        },
        flush: function (tty) {
          if (tty.output && tty.output.length > 0) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }
      },
      default_tty1_ops: {
        put_char: function (tty, val) {
          if (val === null || val === 10) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        },
        flush: function (tty) {
          if (tty.output && tty.output.length > 0) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }
      }
    };
    var MEMFS = {
      ops_table: null,
      mount: function (mount) {
        return MEMFS.createNode(null, "/", 16384 | 511, 0);
      },
      createNode: function (parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
          throw new FS.ErrnoError(63);
        }
        if (!MEMFS.ops_table) {
          MEMFS.ops_table = {
            dir: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                lookup: MEMFS.node_ops.lookup,
                mknod: MEMFS.node_ops.mknod,
                rename: MEMFS.node_ops.rename,
                unlink: MEMFS.node_ops.unlink,
                rmdir: MEMFS.node_ops.rmdir,
                readdir: MEMFS.node_ops.readdir,
                symlink: MEMFS.node_ops.symlink
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek
              }
            },
            file: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek,
                read: MEMFS.stream_ops.read,
                write: MEMFS.stream_ops.write,
                allocate: MEMFS.stream_ops.allocate,
                mmap: MEMFS.stream_ops.mmap,
                msync: MEMFS.stream_ops.msync
              }
            },
            link: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                readlink: MEMFS.node_ops.readlink
              },
              stream: {}
            },
            chrdev: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: FS.chrdev_stream_ops
            }
          };
        }
        var node = FS.createNode(parent, name, mode, dev);
        if (FS.isDir(node.mode)) {
          node.node_ops = MEMFS.ops_table.dir.node;
          node.stream_ops = MEMFS.ops_table.dir.stream;
          node.contents = {};
        } else if (FS.isFile(node.mode)) {
          node.node_ops = MEMFS.ops_table.file.node;
          node.stream_ops = MEMFS.ops_table.file.stream;
          node.usedBytes = 0;
          node.contents = null;
        } else if (FS.isLink(node.mode)) {
          node.node_ops = MEMFS.ops_table.link.node;
          node.stream_ops = MEMFS.ops_table.link.stream;
        } else if (FS.isChrdev(node.mode)) {
          node.node_ops = MEMFS.ops_table.chrdev.node;
          node.stream_ops = MEMFS.ops_table.chrdev.stream;
        }
        node.timestamp = Date.now();
        if (parent) {
          parent.contents[name] = node;
        }
        return node;
      },
      getFileDataAsRegularArray: function (node) {
        if (node.contents && node.contents.subarray) {
          var arr = [];
          for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i]);
          return arr;
        }
        return node.contents;
      },
      getFileDataAsTypedArray: function (node) {
        if (!node.contents) return new Uint8Array(0);
        if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes);
        return new Uint8Array(node.contents);
      },
      expandFileStorage: function (node, newCapacity) {
        var prevCapacity = node.contents ? node.contents.length : 0;
        if (prevCapacity >= newCapacity) return;
        var CAPACITY_DOUBLING_MAX = 1024 * 1024;
        newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) >>> 0);
        if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
        var oldContents = node.contents;
        node.contents = new Uint8Array(newCapacity);
        if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
        return;
      },
      resizeFileStorage: function (node, newSize) {
        if (node.usedBytes == newSize) return;
        if (newSize == 0) {
          node.contents = null;
          node.usedBytes = 0;
          return;
        }
        if (!node.contents || node.contents.subarray) {
          var oldContents = node.contents;
          node.contents = new Uint8Array(newSize);
          if (oldContents) {
            node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)));
          }
          node.usedBytes = newSize;
          return;
        }
        if (!node.contents) node.contents = [];
        if (node.contents.length > newSize) node.contents.length = newSize;else while (node.contents.length < newSize) node.contents.push(0);
        node.usedBytes = newSize;
      },
      node_ops: {
        getattr: function (node) {
          var attr = {};
          attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
          attr.ino = node.id;
          attr.mode = node.mode;
          attr.nlink = 1;
          attr.uid = 0;
          attr.gid = 0;
          attr.rdev = node.rdev;
          if (FS.isDir(node.mode)) {
            attr.size = 4096;
          } else if (FS.isFile(node.mode)) {
            attr.size = node.usedBytes;
          } else if (FS.isLink(node.mode)) {
            attr.size = node.link.length;
          } else {
            attr.size = 0;
          }
          attr.atime = new Date(node.timestamp);
          attr.mtime = new Date(node.timestamp);
          attr.ctime = new Date(node.timestamp);
          attr.blksize = 4096;
          attr.blocks = Math.ceil(attr.size / attr.blksize);
          return attr;
        },
        setattr: function (node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }
          if (attr.size !== undefined) {
            MEMFS.resizeFileStorage(node, attr.size);
          }
        },
        lookup: function (parent, name) {
          throw FS.genericErrors[44];
        },
        mknod: function (parent, name, mode, dev) {
          return MEMFS.createNode(parent, name, mode, dev);
        },
        rename: function (old_node, new_dir, new_name) {
          if (FS.isDir(old_node.mode)) {
            var new_node;
            try {
              new_node = FS.lookupNode(new_dir, new_name);
            } catch (e) {}
            if (new_node) {
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(55);
              }
            }
          }
          delete old_node.parent.contents[old_node.name];
          old_node.name = new_name;
          new_dir.contents[new_name] = old_node;
          old_node.parent = new_dir;
        },
        unlink: function (parent, name) {
          delete parent.contents[name];
        },
        rmdir: function (parent, name) {
          var node = FS.lookupNode(parent, name);
          for (var i in node.contents) {
            throw new FS.ErrnoError(55);
          }
          delete parent.contents[name];
        },
        readdir: function (node) {
          var entries = [".", ".."];
          for (var key in node.contents) {
            if (!node.contents.hasOwnProperty(key)) {
              continue;
            }
            entries.push(key);
          }
          return entries;
        },
        symlink: function (parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
          node.link = oldpath;
          return node;
        },
        readlink: function (node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(28);
          }
          return node.link;
        }
      },
      stream_ops: {
        read: function (stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= stream.node.usedBytes) return 0;
          var size = Math.min(stream.node.usedBytes - position, length);
          if (size > 8 && contents.subarray) {
            buffer.set(contents.subarray(position, position + size), offset);
          } else {
            for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
          }
          return size;
        },
        write: function (stream, buffer, offset, length, position, canOwn) {
          if (buffer.buffer === HEAP8.buffer) {
            canOwn = false;
          }
          if (!length) return 0;
          var node = stream.node;
          node.timestamp = Date.now();
          if (buffer.subarray && (!node.contents || node.contents.subarray)) {
            if (canOwn) {
              node.contents = buffer.subarray(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (node.usedBytes === 0 && position === 0) {
              node.contents = buffer.slice(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (position + length <= node.usedBytes) {
              node.contents.set(buffer.subarray(offset, offset + length), position);
              return length;
            }
          }
          MEMFS.expandFileStorage(node, position + length);
          if (node.contents.subarray && buffer.subarray) node.contents.set(buffer.subarray(offset, offset + length), position);else {
            for (var i = 0; i < length; i++) {
              node.contents[position + i] = buffer[offset + i];
            }
          }
          node.usedBytes = Math.max(node.usedBytes, position + length);
          return length;
        },
        llseek: function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {
            position += stream.position;
          } else if (whence === 2) {
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.usedBytes;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(28);
          }
          return position;
        },
        allocate: function (stream, offset, length) {
          MEMFS.expandFileStorage(stream.node, offset + length);
          stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
        },
        mmap: function (stream, buffer, offset, length, position, prot, flags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          var ptr;
          var allocated;
          var contents = stream.node.contents;
          if (!(flags & 2) && contents.buffer === buffer.buffer) {
            allocated = false;
            ptr = contents.byteOffset;
          } else {
            if (position > 0 || position + length < contents.length) {
              if (contents.subarray) {
                contents = contents.subarray(position, position + length);
              } else {
                contents = Array.prototype.slice.call(contents, position, position + length);
              }
            }
            allocated = true;
            var fromHeap = buffer.buffer == HEAP8.buffer;
            ptr = _malloc(length);
            if (!ptr) {
              throw new FS.ErrnoError(48);
            }
            (fromHeap ? HEAP8 : buffer).set(contents, ptr);
          }
          return {
            ptr: ptr,
            allocated: allocated
          };
        },
        msync: function (stream, buffer, offset, length, mmapFlags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          if (mmapFlags & 2) {
            return 0;
          }
          var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
          return 0;
        }
      }
    };
    var FS = {
      root: null,
      mounts: [],
      devices: {},
      streams: [],
      nextInode: 1,
      nameTable: null,
      currentPath: "/",
      initialized: false,
      ignorePermissions: true,
      trackingDelegate: {},
      tracking: {
        openFlags: {
          READ: 1,
          WRITE: 2
        }
      },
      ErrnoError: null,
      genericErrors: {},
      filesystems: null,
      syncFSRequests: 0,
      handleFSError: function (e) {
        if (!(e instanceof FS.ErrnoError)) throw e + " : " + stackTrace();
        return setErrNo(e.errno);
      },
      lookupPath: function (path, opts) {
        path = PATH_FS.resolve(FS.cwd(), path);
        opts = opts || {};
        if (!path) return {
          path: "",
          node: null
        };
        var defaults = {
          follow_mount: true,
          recurse_count: 0
        };
        for (var key in defaults) {
          if (opts[key] === undefined) {
            opts[key] = defaults[key];
          }
        }
        if (opts.recurse_count > 8) {
          throw new FS.ErrnoError(32);
        }
        var parts = PATH.normalizeArray(path.split("/").filter(function (p) {
          return !!p;
        }), false);
        var current = FS.root;
        var current_path = "/";
        for (var i = 0; i < parts.length; i++) {
          var islast = i === parts.length - 1;
          if (islast && opts.parent) {
            break;
          }
          current = FS.lookupNode(current, parts[i]);
          current_path = PATH.join2(current_path, parts[i]);
          if (FS.isMountpoint(current)) {
            if (!islast || islast && opts.follow_mount) {
              current = current.mounted.root;
            }
          }
          if (!islast || opts.follow) {
            var count = 0;
            while (FS.isLink(current.mode)) {
              var link = FS.readlink(current_path);
              current_path = PATH_FS.resolve(PATH.dirname(current_path), link);
              var lookup = FS.lookupPath(current_path, {
                recurse_count: opts.recurse_count
              });
              current = lookup.node;
              if (count++ > 40) {
                throw new FS.ErrnoError(32);
              }
            }
          }
        }
        return {
          path: current_path,
          node: current
        };
      },
      getPath: function (node) {
        var path;
        while (true) {
          if (FS.isRoot(node)) {
            var mount = node.mount.mountpoint;
            if (!path) return mount;
            return mount[mount.length - 1] !== "/" ? mount + "/" + path : mount + path;
          }
          path = path ? node.name + "/" + path : node.name;
          node = node.parent;
        }
      },
      hashName: function (parentid, name) {
        var hash = 0;
        for (var i = 0; i < name.length; i++) {
          hash = (hash << 5) - hash + name.charCodeAt(i) | 0;
        }
        return (parentid + hash >>> 0) % FS.nameTable.length;
      },
      hashAddNode: function (node) {
        var hash = FS.hashName(node.parent.id, node.name);
        node.name_next = FS.nameTable[hash];
        FS.nameTable[hash] = node;
      },
      hashRemoveNode: function (node) {
        var hash = FS.hashName(node.parent.id, node.name);
        if (FS.nameTable[hash] === node) {
          FS.nameTable[hash] = node.name_next;
        } else {
          var current = FS.nameTable[hash];
          while (current) {
            if (current.name_next === node) {
              current.name_next = node.name_next;
              break;
            }
            current = current.name_next;
          }
        }
      },
      lookupNode: function (parent, name) {
        var errCode = FS.mayLookup(parent);
        if (errCode) {
          throw new FS.ErrnoError(errCode, parent);
        }
        var hash = FS.hashName(parent.id, name);
        for (var node = FS.nameTable[hash]; node; node = node.name_next) {
          var nodeName = node.name;
          if (node.parent.id === parent.id && nodeName === name) {
            return node;
          }
        }
        return FS.lookup(parent, name);
      },
      createNode: function (parent, name, mode, rdev) {
        var node = new FS.FSNode(parent, name, mode, rdev);
        FS.hashAddNode(node);
        return node;
      },
      destroyNode: function (node) {
        FS.hashRemoveNode(node);
      },
      isRoot: function (node) {
        return node === node.parent;
      },
      isMountpoint: function (node) {
        return !!node.mounted;
      },
      isFile: function (mode) {
        return (mode & 61440) === 32768;
      },
      isDir: function (mode) {
        return (mode & 61440) === 16384;
      },
      isLink: function (mode) {
        return (mode & 61440) === 40960;
      },
      isChrdev: function (mode) {
        return (mode & 61440) === 8192;
      },
      isBlkdev: function (mode) {
        return (mode & 61440) === 24576;
      },
      isFIFO: function (mode) {
        return (mode & 61440) === 4096;
      },
      isSocket: function (mode) {
        return (mode & 49152) === 49152;
      },
      flagModes: {
        "r": 0,
        "rs": 1052672,
        "r+": 2,
        "w": 577,
        "wx": 705,
        "xw": 705,
        "w+": 578,
        "wx+": 706,
        "xw+": 706,
        "a": 1089,
        "ax": 1217,
        "xa": 1217,
        "a+": 1090,
        "ax+": 1218,
        "xa+": 1218
      },
      modeStringToFlags: function (str) {
        var flags = FS.flagModes[str];
        if (typeof flags === "undefined") {
          throw new Error("Unknown file open mode: " + str);
        }
        return flags;
      },
      flagsToPermissionString: function (flag) {
        var perms = ["r", "w", "rw"][flag & 3];
        if (flag & 512) {
          perms += "w";
        }
        return perms;
      },
      nodePermissions: function (node, perms) {
        if (FS.ignorePermissions) {
          return 0;
        }
        if (perms.indexOf("r") !== -1 && !(node.mode & 292)) {
          return 2;
        } else if (perms.indexOf("w") !== -1 && !(node.mode & 146)) {
          return 2;
        } else if (perms.indexOf("x") !== -1 && !(node.mode & 73)) {
          return 2;
        }
        return 0;
      },
      mayLookup: function (dir) {
        var errCode = FS.nodePermissions(dir, "x");
        if (errCode) return errCode;
        if (!dir.node_ops.lookup) return 2;
        return 0;
      },
      mayCreate: function (dir, name) {
        try {
          var node = FS.lookupNode(dir, name);
          return 20;
        } catch (e) {}
        return FS.nodePermissions(dir, "wx");
      },
      mayDelete: function (dir, name, isdir) {
        var node;
        try {
          node = FS.lookupNode(dir, name);
        } catch (e) {
          return e.errno;
        }
        var errCode = FS.nodePermissions(dir, "wx");
        if (errCode) {
          return errCode;
        }
        if (isdir) {
          if (!FS.isDir(node.mode)) {
            return 54;
          }
          if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
            return 10;
          }
        } else {
          if (FS.isDir(node.mode)) {
            return 31;
          }
        }
        return 0;
      },
      mayOpen: function (node, flags) {
        if (!node) {
          return 44;
        }
        if (FS.isLink(node.mode)) {
          return 32;
        } else if (FS.isDir(node.mode)) {
          if (FS.flagsToPermissionString(flags) !== "r" || flags & 512) {
            return 31;
          }
        }
        return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
      },
      MAX_OPEN_FDS: 4096,
      nextfd: function (fd_start, fd_end) {
        fd_start = fd_start || 0;
        fd_end = fd_end || FS.MAX_OPEN_FDS;
        for (var fd = fd_start; fd <= fd_end; fd++) {
          if (!FS.streams[fd]) {
            return fd;
          }
        }
        throw new FS.ErrnoError(33);
      },
      getStream: function (fd) {
        return FS.streams[fd];
      },
      createStream: function (stream, fd_start, fd_end) {
        if (!FS.FSStream) {
          FS.FSStream = function () {};
          FS.FSStream.prototype = {
            object: {
              get: function () {
                return this.node;
              },
              set: function (val) {
                this.node = val;
              }
            },
            isRead: {
              get: function () {
                return (this.flags & 2097155) !== 1;
              }
            },
            isWrite: {
              get: function () {
                return (this.flags & 2097155) !== 0;
              }
            },
            isAppend: {
              get: function () {
                return this.flags & 1024;
              }
            }
          };
        }
        var newStream = new FS.FSStream();
        for (var p in stream) {
          newStream[p] = stream[p];
        }
        stream = newStream;
        var fd = FS.nextfd(fd_start, fd_end);
        stream.fd = fd;
        FS.streams[fd] = stream;
        return stream;
      },
      closeStream: function (fd) {
        FS.streams[fd] = null;
      },
      chrdev_stream_ops: {
        open: function (stream) {
          var device = FS.getDevice(stream.node.rdev);
          stream.stream_ops = device.stream_ops;
          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream);
          }
        },
        llseek: function () {
          throw new FS.ErrnoError(70);
        }
      },
      major: function (dev) {
        return dev >> 8;
      },
      minor: function (dev) {
        return dev & 255;
      },
      makedev: function (ma, mi) {
        return ma << 8 | mi;
      },
      registerDevice: function (dev, ops) {
        FS.devices[dev] = {
          stream_ops: ops
        };
      },
      getDevice: function (dev) {
        return FS.devices[dev];
      },
      getMounts: function (mount) {
        var mounts = [];
        var check = [mount];
        while (check.length) {
          var m = check.pop();
          mounts.push(m);
          check.push.apply(check, m.mounts);
        }
        return mounts;
      },
      syncfs: function (populate, callback) {
        if (typeof populate === "function") {
          callback = populate;
          populate = false;
        }
        FS.syncFSRequests++;
        if (FS.syncFSRequests > 1) {
          err("warning: " + FS.syncFSRequests + " FS.syncfs operations in flight at once, probably just doing extra work");
        }
        var mounts = FS.getMounts(FS.root.mount);
        var completed = 0;
        function doCallback(errCode) {
          FS.syncFSRequests--;
          return callback(errCode);
        }
        function done(errCode) {
          if (errCode) {
            if (!done.errored) {
              done.errored = true;
              return doCallback(errCode);
            }
            return;
          }
          if (++completed >= mounts.length) {
            doCallback(null);
          }
        }
        mounts.forEach(function (mount) {
          if (!mount.type.syncfs) {
            return done(null);
          }
          mount.type.syncfs(mount, populate, done);
        });
      },
      mount: function (type, opts, mountpoint) {
        var root = mountpoint === "/";
        var pseudo = !mountpoint;
        var node;
        if (root && FS.root) {
          throw new FS.ErrnoError(10);
        } else if (!root && !pseudo) {
          var lookup = FS.lookupPath(mountpoint, {
            follow_mount: false
          });
          mountpoint = lookup.path;
          node = lookup.node;
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(10);
          }
          if (!FS.isDir(node.mode)) {
            throw new FS.ErrnoError(54);
          }
        }
        var mount = {
          type: type,
          opts: opts,
          mountpoint: mountpoint,
          mounts: []
        };
        var mountRoot = type.mount(mount);
        mountRoot.mount = mount;
        mount.root = mountRoot;
        if (root) {
          FS.root = mountRoot;
        } else if (node) {
          node.mounted = mount;
          if (node.mount) {
            node.mount.mounts.push(mount);
          }
        }
        return mountRoot;
      },
      unmount: function (mountpoint) {
        var lookup = FS.lookupPath(mountpoint, {
          follow_mount: false
        });
        if (!FS.isMountpoint(lookup.node)) {
          throw new FS.ErrnoError(28);
        }
        var node = lookup.node;
        var mount = node.mounted;
        var mounts = FS.getMounts(mount);
        Object.keys(FS.nameTable).forEach(function (hash) {
          var current = FS.nameTable[hash];
          while (current) {
            var next = current.name_next;
            if (mounts.indexOf(current.mount) !== -1) {
              FS.destroyNode(current);
            }
            current = next;
          }
        });
        node.mounted = null;
        var idx = node.mount.mounts.indexOf(mount);
        node.mount.mounts.splice(idx, 1);
      },
      lookup: function (parent, name) {
        return parent.node_ops.lookup(parent, name);
      },
      mknod: function (path, mode, dev) {
        var lookup = FS.lookupPath(path, {
          parent: true
        });
        var parent = lookup.node;
        var name = PATH.basename(path);
        if (!name || name === "." || name === "..") {
          throw new FS.ErrnoError(28);
        }
        var errCode = FS.mayCreate(parent, name);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.mknod) {
          throw new FS.ErrnoError(63);
        }
        return parent.node_ops.mknod(parent, name, mode, dev);
      },
      create: function (path, mode) {
        mode = mode !== undefined ? mode : 438;
        mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0);
      },
      mkdir: function (path, mode) {
        mode = mode !== undefined ? mode : 511;
        mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0);
      },
      mkdirTree: function (path, mode) {
        var dirs = path.split("/");
        var d = "";
        for (var i = 0; i < dirs.length; ++i) {
          if (!dirs[i]) continue;
          d += "/" + dirs[i];
          try {
            FS.mkdir(d, mode);
          } catch (e) {
            if (e.errno != 20) throw e;
          }
        }
      },
      mkdev: function (path, mode, dev) {
        if (typeof dev === "undefined") {
          dev = mode;
          mode = 438;
        }
        mode |= 8192;
        return FS.mknod(path, mode, dev);
      },
      symlink: function (oldpath, newpath) {
        if (!PATH_FS.resolve(oldpath)) {
          throw new FS.ErrnoError(44);
        }
        var lookup = FS.lookupPath(newpath, {
          parent: true
        });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(44);
        }
        var newname = PATH.basename(newpath);
        var errCode = FS.mayCreate(parent, newname);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.symlink) {
          throw new FS.ErrnoError(63);
        }
        return parent.node_ops.symlink(parent, newname, oldpath);
      },
      rename: function (old_path, new_path) {
        var old_dirname = PATH.dirname(old_path);
        var new_dirname = PATH.dirname(new_path);
        var old_name = PATH.basename(old_path);
        var new_name = PATH.basename(new_path);
        var lookup, old_dir, new_dir;
        try {
          lookup = FS.lookupPath(old_path, {
            parent: true
          });
          old_dir = lookup.node;
          lookup = FS.lookupPath(new_path, {
            parent: true
          });
          new_dir = lookup.node;
        } catch (e) {
          throw new FS.ErrnoError(10);
        }
        if (!old_dir || !new_dir) throw new FS.ErrnoError(44);
        if (old_dir.mount !== new_dir.mount) {
          throw new FS.ErrnoError(75);
        }
        var old_node = FS.lookupNode(old_dir, old_name);
        var relative = PATH_FS.relative(old_path, new_dirname);
        if (relative.charAt(0) !== ".") {
          throw new FS.ErrnoError(28);
        }
        relative = PATH_FS.relative(new_path, old_dirname);
        if (relative.charAt(0) !== ".") {
          throw new FS.ErrnoError(55);
        }
        var new_node;
        try {
          new_node = FS.lookupNode(new_dir, new_name);
        } catch (e) {}
        if (old_node === new_node) {
          return;
        }
        var isdir = FS.isDir(old_node.mode);
        var errCode = FS.mayDelete(old_dir, old_name, isdir);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        errCode = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!old_dir.node_ops.rename) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
          throw new FS.ErrnoError(10);
        }
        if (new_dir !== old_dir) {
          errCode = FS.nodePermissions(old_dir, "w");
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
        }
        try {
          if (FS.trackingDelegate["willMovePath"]) {
            FS.trackingDelegate["willMovePath"](old_path, new_path);
          }
        } catch (e) {
          err("FS.trackingDelegate['willMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message);
        }
        FS.hashRemoveNode(old_node);
        try {
          old_dir.node_ops.rename(old_node, new_dir, new_name);
        } catch (e) {
          throw e;
        } finally {
          FS.hashAddNode(old_node);
        }
        try {
          if (FS.trackingDelegate["onMovePath"]) FS.trackingDelegate["onMovePath"](old_path, new_path);
        } catch (e) {
          err("FS.trackingDelegate['onMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message);
        }
      },
      rmdir: function (path) {
        var lookup = FS.lookupPath(path, {
          parent: true
        });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, true);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.rmdir) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10);
        }
        try {
          if (FS.trackingDelegate["willDeletePath"]) {
            FS.trackingDelegate["willDeletePath"](path);
          }
        } catch (e) {
          err("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message);
        }
        parent.node_ops.rmdir(parent, name);
        FS.destroyNode(node);
        try {
          if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path);
        } catch (e) {
          err("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message);
        }
      },
      readdir: function (path) {
        var lookup = FS.lookupPath(path, {
          follow: true
        });
        var node = lookup.node;
        if (!node.node_ops.readdir) {
          throw new FS.ErrnoError(54);
        }
        return node.node_ops.readdir(node);
      },
      unlink: function (path) {
        var lookup = FS.lookupPath(path, {
          parent: true
        });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, false);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.unlink) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10);
        }
        try {
          if (FS.trackingDelegate["willDeletePath"]) {
            FS.trackingDelegate["willDeletePath"](path);
          }
        } catch (e) {
          err("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message);
        }
        parent.node_ops.unlink(parent, name);
        FS.destroyNode(node);
        try {
          if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path);
        } catch (e) {
          err("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message);
        }
      },
      readlink: function (path) {
        var lookup = FS.lookupPath(path);
        var link = lookup.node;
        if (!link) {
          throw new FS.ErrnoError(44);
        }
        if (!link.node_ops.readlink) {
          throw new FS.ErrnoError(28);
        }
        return PATH_FS.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
      },
      stat: function (path, dontFollow) {
        var lookup = FS.lookupPath(path, {
          follow: !dontFollow
        });
        var node = lookup.node;
        if (!node) {
          throw new FS.ErrnoError(44);
        }
        if (!node.node_ops.getattr) {
          throw new FS.ErrnoError(63);
        }
        return node.node_ops.getattr(node);
      },
      lstat: function (path) {
        return FS.stat(path, true);
      },
      chmod: function (path, mode, dontFollow) {
        var node;
        if (typeof path === "string") {
          var lookup = FS.lookupPath(path, {
            follow: !dontFollow
          });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }
        node.node_ops.setattr(node, {
          mode: mode & 4095 | node.mode & ~4095,
          timestamp: Date.now()
        });
      },
      lchmod: function (path, mode) {
        FS.chmod(path, mode, true);
      },
      fchmod: function (fd, mode) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(8);
        }
        FS.chmod(stream.node, mode);
      },
      chown: function (path, uid, gid, dontFollow) {
        var node;
        if (typeof path === "string") {
          var lookup = FS.lookupPath(path, {
            follow: !dontFollow
          });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }
        node.node_ops.setattr(node, {
          timestamp: Date.now()
        });
      },
      lchown: function (path, uid, gid) {
        FS.chown(path, uid, gid, true);
      },
      fchown: function (fd, uid, gid) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(8);
        }
        FS.chown(stream.node, uid, gid);
      },
      truncate: function (path, len) {
        if (len < 0) {
          throw new FS.ErrnoError(28);
        }
        var node;
        if (typeof path === "string") {
          var lookup = FS.lookupPath(path, {
            follow: true
          });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isDir(node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!FS.isFile(node.mode)) {
          throw new FS.ErrnoError(28);
        }
        var errCode = FS.nodePermissions(node, "w");
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        node.node_ops.setattr(node, {
          size: len,
          timestamp: Date.now()
        });
      },
      ftruncate: function (fd, len) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(8);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(28);
        }
        FS.truncate(stream.node, len);
      },
      utime: function (path, atime, mtime) {
        var lookup = FS.lookupPath(path, {
          follow: true
        });
        var node = lookup.node;
        node.node_ops.setattr(node, {
          timestamp: Math.max(atime, mtime)
        });
      },
      open: function (path, flags, mode, fd_start, fd_end) {
        if (path === "") {
          throw new FS.ErrnoError(44);
        }
        flags = typeof flags === "string" ? FS.modeStringToFlags(flags) : flags;
        mode = typeof mode === "undefined" ? 438 : mode;
        if (flags & 64) {
          mode = mode & 4095 | 32768;
        } else {
          mode = 0;
        }
        var node;
        if (typeof path === "object") {
          node = path;
        } else {
          path = PATH.normalize(path);
          try {
            var lookup = FS.lookupPath(path, {
              follow: !(flags & 131072)
            });
            node = lookup.node;
          } catch (e) {}
        }
        var created = false;
        if (flags & 64) {
          if (node) {
            if (flags & 128) {
              throw new FS.ErrnoError(20);
            }
          } else {
            node = FS.mknod(path, mode, 0);
            created = true;
          }
        }
        if (!node) {
          throw new FS.ErrnoError(44);
        }
        if (FS.isChrdev(node.mode)) {
          flags &= ~512;
        }
        if (flags & 65536 && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(54);
        }
        if (!created) {
          var errCode = FS.mayOpen(node, flags);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
        }
        if (flags & 512) {
          FS.truncate(node, 0);
        }
        flags &= ~(128 | 512 | 131072);
        var stream = FS.createStream({
          node: node,
          path: FS.getPath(node),
          flags: flags,
          seekable: true,
          position: 0,
          stream_ops: node.stream_ops,
          ungotten: [],
          error: false
        }, fd_start, fd_end);
        if (stream.stream_ops.open) {
          stream.stream_ops.open(stream);
        }
        if (Module["logReadFiles"] && !(flags & 1)) {
          if (!FS.readFiles) FS.readFiles = {};
          if (!(path in FS.readFiles)) {
            FS.readFiles[path] = 1;
            err("FS.trackingDelegate error on read file: " + path);
          }
        }
        try {
          if (FS.trackingDelegate["onOpenFile"]) {
            var trackingFlags = 0;
            if ((flags & 2097155) !== 1) {
              trackingFlags |= FS.tracking.openFlags.READ;
            }
            if ((flags & 2097155) !== 0) {
              trackingFlags |= FS.tracking.openFlags.WRITE;
            }
            FS.trackingDelegate["onOpenFile"](path, trackingFlags);
          }
        } catch (e) {
          err("FS.trackingDelegate['onOpenFile']('" + path + "', flags) threw an exception: " + e.message);
        }
        return stream;
      },
      close: function (stream) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (stream.getdents) stream.getdents = null;
        try {
          if (stream.stream_ops.close) {
            stream.stream_ops.close(stream);
          }
        } catch (e) {
          throw e;
        } finally {
          FS.closeStream(stream.fd);
        }
        stream.fd = null;
      },
      isClosed: function (stream) {
        return stream.fd === null;
      },
      llseek: function (stream, offset, whence) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (!stream.seekable || !stream.stream_ops.llseek) {
          throw new FS.ErrnoError(70);
        }
        if (whence != 0 && whence != 1 && whence != 2) {
          throw new FS.ErrnoError(28);
        }
        stream.position = stream.stream_ops.llseek(stream, offset, whence);
        stream.ungotten = [];
        return stream.position;
      },
      read: function (stream, buffer, offset, length, position) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(8);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!stream.stream_ops.read) {
          throw new FS.ErrnoError(28);
        }
        var seeking = typeof position !== "undefined";
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70);
        }
        var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
        if (!seeking) stream.position += bytesRead;
        return bytesRead;
      },
      write: function (stream, buffer, offset, length, position, canOwn) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(8);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!stream.stream_ops.write) {
          throw new FS.ErrnoError(28);
        }
        if (stream.seekable && stream.flags & 1024) {
          FS.llseek(stream, 0, 2);
        }
        var seeking = typeof position !== "undefined";
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70);
        }
        var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
        if (!seeking) stream.position += bytesWritten;
        try {
          if (stream.path && FS.trackingDelegate["onWriteToFile"]) FS.trackingDelegate["onWriteToFile"](stream.path);
        } catch (e) {
          err("FS.trackingDelegate['onWriteToFile']('" + stream.path + "') threw an exception: " + e.message);
        }
        return bytesWritten;
      },
      allocate: function (stream, offset, length) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (offset < 0 || length <= 0) {
          throw new FS.ErrnoError(28);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(8);
        }
        if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(43);
        }
        if (!stream.stream_ops.allocate) {
          throw new FS.ErrnoError(138);
        }
        stream.stream_ops.allocate(stream, offset, length);
      },
      mmap: function (stream, buffer, offset, length, position, prot, flags) {
        if ((prot & 2) !== 0 && (flags & 2) === 0 && (stream.flags & 2097155) !== 2) {
          throw new FS.ErrnoError(2);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(2);
        }
        if (!stream.stream_ops.mmap) {
          throw new FS.ErrnoError(43);
        }
        return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags);
      },
      msync: function (stream, buffer, offset, length, mmapFlags) {
        if (!stream || !stream.stream_ops.msync) {
          return 0;
        }
        return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
      },
      munmap: function (stream) {
        return 0;
      },
      ioctl: function (stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
          throw new FS.ErrnoError(59);
        }
        return stream.stream_ops.ioctl(stream, cmd, arg);
      },
      readFile: function (path, opts) {
        opts = opts || {};
        opts.flags = opts.flags || "r";
        opts.encoding = opts.encoding || "binary";
        if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
          throw new Error('Invalid encoding type "' + opts.encoding + '"');
        }
        var ret;
        var stream = FS.open(path, opts.flags);
        var stat = FS.stat(path);
        var length = stat.size;
        var buf = new Uint8Array(length);
        FS.read(stream, buf, 0, length, 0);
        if (opts.encoding === "utf8") {
          ret = UTF8ArrayToString(buf, 0);
        } else if (opts.encoding === "binary") {
          ret = buf;
        }
        FS.close(stream);
        return ret;
      },
      writeFile: function (path, data, opts) {
        opts = opts || {};
        opts.flags = opts.flags || "w";
        var stream = FS.open(path, opts.flags, opts.mode);
        if (typeof data === "string") {
          var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
          var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
          FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn);
        } else if (ArrayBuffer.isView(data)) {
          FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
        } else {
          throw new Error("Unsupported data type");
        }
        FS.close(stream);
      },
      cwd: function () {
        return FS.currentPath;
      },
      chdir: function (path) {
        var lookup = FS.lookupPath(path, {
          follow: true
        });
        if (lookup.node === null) {
          throw new FS.ErrnoError(44);
        }
        if (!FS.isDir(lookup.node.mode)) {
          throw new FS.ErrnoError(54);
        }
        var errCode = FS.nodePermissions(lookup.node, "x");
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        FS.currentPath = lookup.path;
      },
      createDefaultDirectories: function () {
        FS.mkdir("/tmp");
        FS.mkdir("/home");
        FS.mkdir("/home/web_user");
      },
      createDefaultDevices: function () {
        FS.mkdir("/dev");
        FS.registerDevice(FS.makedev(1, 3), {
          read: function () {
            return 0;
          },
          write: function (stream, buffer, offset, length, pos) {
            return length;
          }
        });
        FS.mkdev("/dev/null", FS.makedev(1, 3));
        TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
        TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
        FS.mkdev("/dev/tty", FS.makedev(5, 0));
        FS.mkdev("/dev/tty1", FS.makedev(6, 0));
        var random_device;
        if (typeof crypto === "object" && typeof crypto["getRandomValues"] === "function") {
          var randomBuffer = new Uint8Array(1);
          random_device = function () {
            crypto.getRandomValues(randomBuffer);
            return randomBuffer[0];
          };
        } else {}
        if (!random_device) {
          random_device = function () {
            abort("random_device");
          };
        }
        FS.createDevice("/dev", "random", random_device);
        FS.createDevice("/dev", "urandom", random_device);
        FS.mkdir("/dev/shm");
        FS.mkdir("/dev/shm/tmp");
      },
      createSpecialDirectories: function () {
        FS.mkdir("/proc");
        FS.mkdir("/proc/self");
        FS.mkdir("/proc/self/fd");
        FS.mount({
          mount: function () {
            var node = FS.createNode("/proc/self", "fd", 16384 | 511, 73);
            node.node_ops = {
              lookup: function (parent, name) {
                var fd = +name;
                var stream = FS.getStream(fd);
                if (!stream) throw new FS.ErrnoError(8);
                var ret = {
                  parent: null,
                  mount: {
                    mountpoint: "fake"
                  },
                  node_ops: {
                    readlink: function () {
                      return stream.path;
                    }
                  }
                };
                ret.parent = ret;
                return ret;
              }
            };
            return node;
          }
        }, {}, "/proc/self/fd");
      },
      createStandardStreams: function () {
        if (Module["stdin"]) {
          FS.createDevice("/dev", "stdin", Module["stdin"]);
        } else {
          FS.symlink("/dev/tty", "/dev/stdin");
        }
        if (Module["stdout"]) {
          FS.createDevice("/dev", "stdout", null, Module["stdout"]);
        } else {
          FS.symlink("/dev/tty", "/dev/stdout");
        }
        if (Module["stderr"]) {
          FS.createDevice("/dev", "stderr", null, Module["stderr"]);
        } else {
          FS.symlink("/dev/tty1", "/dev/stderr");
        }
        var stdin = FS.open("/dev/stdin", "r");
        var stdout = FS.open("/dev/stdout", "w");
        var stderr = FS.open("/dev/stderr", "w");
      },
      ensureErrnoError: function () {
        if (FS.ErrnoError) return;
        FS.ErrnoError = function ErrnoError(errno, node) {
          this.node = node;
          this.setErrno = function (errno) {
            this.errno = errno;
          };
          this.setErrno(errno);
          this.message = "FS error";
        };
        FS.ErrnoError.prototype = new Error();
        FS.ErrnoError.prototype.constructor = FS.ErrnoError;
        [44].forEach(function (code) {
          FS.genericErrors[code] = new FS.ErrnoError(code);
          FS.genericErrors[code].stack = "<generic error, no stack>";
        });
      },
      staticInit: function () {
        FS.ensureErrnoError();
        FS.nameTable = new Array(4096);
        FS.mount(MEMFS, {}, "/");
        FS.createDefaultDirectories();
        FS.createDefaultDevices();
        FS.createSpecialDirectories();
        FS.filesystems = {
          "MEMFS": MEMFS
        };
      },
      init: function (input, output, error) {
        FS.init.initialized = true;
        FS.ensureErrnoError();
        Module["stdin"] = input || Module["stdin"];
        Module["stdout"] = output || Module["stdout"];
        Module["stderr"] = error || Module["stderr"];
        FS.createStandardStreams();
      },
      quit: function () {
        FS.init.initialized = false;
        var fflush = Module["_fflush"];
        if (fflush) fflush(0);
        for (var i = 0; i < FS.streams.length; i++) {
          var stream = FS.streams[i];
          if (!stream) {
            continue;
          }
          FS.close(stream);
        }
      },
      getMode: function (canRead, canWrite) {
        var mode = 0;
        if (canRead) mode |= 292 | 73;
        if (canWrite) mode |= 146;
        return mode;
      },
      joinPath: function (parts, forceRelative) {
        var path = PATH.join.apply(null, parts);
        if (forceRelative && path[0] == "/") path = path.substr(1);
        return path;
      },
      absolutePath: function (relative, base) {
        return PATH_FS.resolve(base, relative);
      },
      standardizePath: function (path) {
        return PATH.normalize(path);
      },
      findObject: function (path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (ret.exists) {
          return ret.object;
        } else {
          setErrNo(ret.error);
          return null;
        }
      },
      analyzePath: function (path, dontResolveLastLink) {
        try {
          var lookup = FS.lookupPath(path, {
            follow: !dontResolveLastLink
          });
          path = lookup.path;
        } catch (e) {}
        var ret = {
          isRoot: false,
          exists: false,
          error: 0,
          name: null,
          path: null,
          object: null,
          parentExists: false,
          parentPath: null,
          parentObject: null
        };
        try {
          var lookup = FS.lookupPath(path, {
            parent: true
          });
          ret.parentExists = true;
          ret.parentPath = lookup.path;
          ret.parentObject = lookup.node;
          ret.name = PATH.basename(path);
          lookup = FS.lookupPath(path, {
            follow: !dontResolveLastLink
          });
          ret.exists = true;
          ret.path = lookup.path;
          ret.object = lookup.node;
          ret.name = lookup.node.name;
          ret.isRoot = lookup.path === "/";
        } catch (e) {
          ret.error = e.errno;
        }
        return ret;
      },
      createFolder: function (parent, name, canRead, canWrite) {
        var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.mkdir(path, mode);
      },
      createPath: function (parent, path, canRead, canWrite) {
        parent = typeof parent === "string" ? parent : FS.getPath(parent);
        var parts = path.split("/").reverse();
        while (parts.length) {
          var part = parts.pop();
          if (!part) continue;
          var current = PATH.join2(parent, part);
          try {
            FS.mkdir(current);
          } catch (e) {}
          parent = current;
        }
        return current;
      },
      createFile: function (parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.create(path, mode);
      },
      createDataFile: function (parent, name, data, canRead, canWrite, canOwn) {
        var path = name ? PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name) : parent;
        var mode = FS.getMode(canRead, canWrite);
        var node = FS.create(path, mode);
        if (data) {
          if (typeof data === "string") {
            var arr = new Array(data.length);
            for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
            data = arr;
          }
          FS.chmod(node, mode | 146);
          var stream = FS.open(node, "w");
          FS.write(stream, data, 0, data.length, 0, canOwn);
          FS.close(stream);
          FS.chmod(node, mode);
        }
        return node;
      },
      createDevice: function (parent, name, input, output) {
        var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(!!input, !!output);
        if (!FS.createDevice.major) FS.createDevice.major = 64;
        var dev = FS.makedev(FS.createDevice.major++, 0);
        FS.registerDevice(dev, {
          open: function (stream) {
            stream.seekable = false;
          },
          close: function (stream) {
            if (output && output.buffer && output.buffer.length) {
              output(10);
            }
          },
          read: function (stream, buffer, offset, length, pos) {
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
              var result;
              try {
                result = input();
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
              if (result === undefined && bytesRead === 0) {
                throw new FS.ErrnoError(6);
              }
              if (result === null || result === undefined) break;
              bytesRead++;
              buffer[offset + i] = result;
            }
            if (bytesRead) {
              stream.node.timestamp = Date.now();
            }
            return bytesRead;
          },
          write: function (stream, buffer, offset, length, pos) {
            for (var i = 0; i < length; i++) {
              try {
                output(buffer[offset + i]);
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
            }
            if (length) {
              stream.node.timestamp = Date.now();
            }
            return i;
          }
        });
        return FS.mkdev(path, mode, dev);
      },
      createLink: function (parent, name, target, canRead, canWrite) {
        var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
        return FS.symlink(target, path);
      },
      forceLoadFile: function (obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
        var success = true;
        if (typeof XMLHttpRequest !== "undefined") {
          throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
        } else if (read_) {
          try {
            obj.contents = intArrayFromString(read_(obj.url), true);
            obj.usedBytes = obj.contents.length;
          } catch (e) {
            success = false;
          }
        } else {
          throw new Error("Cannot load without read() or XMLHttpRequest.");
        }
        if (!success) setErrNo(29);
        return success;
      },
      createLazyFile: function (parent, name, url, canRead, canWrite) {
        function LazyUint8Array() {
          this.lengthKnown = false;
          this.chunks = [];
        }
        LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
          if (idx > this.length - 1 || idx < 0) {
            return undefined;
          }
          var chunkOffset = idx % this.chunkSize;
          var chunkNum = idx / this.chunkSize | 0;
          return this.getter(chunkNum)[chunkOffset];
        };
        LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
          this.getter = getter;
        };
        LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
          var xhr = new XMLHttpRequest();
          xhr.open("HEAD", url, false);
          xhr.send(null);
          if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
          var datalength = Number(xhr.getResponseHeader("Content-length"));
          var header;
          var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
          var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
          var chunkSize = 1024 * 1024;
          if (!hasByteServing) chunkSize = datalength;
          var doXHR = function (from, to) {
            if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
            if (to > datalength - 1) throw new Error("only " + datalength + " bytes available! programmer error!");
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, false);
            if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
            if (typeof Uint8Array != "undefined") xhr.responseType = "arraybuffer";
            if (xhr.overrideMimeType) {
              xhr.overrideMimeType("text/plain; charset=x-user-defined");
            }
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
            if (xhr.response !== undefined) {
              return new Uint8Array(xhr.response || []);
            } else {
              return intArrayFromString(xhr.responseText || "", true);
            }
          };
          var lazyArray = this;
          lazyArray.setDataGetter(function (chunkNum) {
            var start = chunkNum * chunkSize;
            var end = (chunkNum + 1) * chunkSize - 1;
            end = Math.min(end, datalength - 1);
            if (typeof lazyArray.chunks[chunkNum] === "undefined") {
              lazyArray.chunks[chunkNum] = doXHR(start, end);
            }
            if (typeof lazyArray.chunks[chunkNum] === "undefined") throw new Error("doXHR failed!");
            return lazyArray.chunks[chunkNum];
          });
          if (usesGzip || !datalength) {
            chunkSize = datalength = 1;
            datalength = this.getter(0).length;
            chunkSize = datalength;
            out("LazyFiles on gzip forces download of the whole file when length is accessed");
          }
          this._length = datalength;
          this._chunkSize = chunkSize;
          this.lengthKnown = true;
        };
        if (typeof XMLHttpRequest !== "undefined") {
          if (!ENVIRONMENT_IS_WORKER) throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
          var lazyArray = new LazyUint8Array();
          Object.defineProperties(lazyArray, {
            length: {
              get: function () {
                if (!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._length;
              }
            },
            chunkSize: {
              get: function () {
                if (!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._chunkSize;
              }
            }
          });
          var properties = {
            isDevice: false,
            contents: lazyArray
          };
        } else {
          var properties = {
            isDevice: false,
            url: url
          };
        }
        var node = FS.createFile(parent, name, properties, canRead, canWrite);
        if (properties.contents) {
          node.contents = properties.contents;
        } else if (properties.url) {
          node.contents = null;
          node.url = properties.url;
        }
        Object.defineProperties(node, {
          usedBytes: {
            get: function () {
              return this.contents.length;
            }
          }
        });
        var stream_ops = {};
        var keys = Object.keys(node.stream_ops);
        keys.forEach(function (key) {
          var fn = node.stream_ops[key];
          stream_ops[key] = function forceLoadLazyFile() {
            if (!FS.forceLoadFile(node)) {
              throw new FS.ErrnoError(29);
            }
            return fn.apply(null, arguments);
          };
        });
        stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
          if (!FS.forceLoadFile(node)) {
            throw new FS.ErrnoError(29);
          }
          var contents = stream.node.contents;
          if (position >= contents.length) return 0;
          var size = Math.min(contents.length - position, length);
          if (contents.slice) {
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents[position + i];
            }
          } else {
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents.get(position + i);
            }
          }
          return size;
        };
        node.stream_ops = stream_ops;
        return node;
      },
      createPreloadedFile: function (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
        Browser.init();
        var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
        var dep = getUniqueRunDependency("cp " + fullname);
        function processData(byteArray) {
          function finish(byteArray) {
            if (preFinish) preFinish();
            if (!dontCreateFile) {
              FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
            }
            if (onload) onload();
            removeRunDependency(dep);
          }
          var handled = false;
          Module["preloadPlugins"].forEach(function (plugin) {
            if (handled) return;
            if (plugin["canHandle"](fullname)) {
              plugin["handle"](byteArray, fullname, finish, function () {
                if (onerror) onerror();
                removeRunDependency(dep);
              });
              handled = true;
            }
          });
          if (!handled) finish(byteArray);
        }
        addRunDependency(dep);
        if (typeof url == "string") {
          Browser.asyncLoad(url, function (byteArray) {
            processData(byteArray);
          }, onerror);
        } else {
          processData(url);
        }
      },
      indexedDB: function () {
        return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      },
      DB_NAME: function () {
        return "EM_FS_" + window.location.pathname;
      },
      DB_VERSION: 20,
      DB_STORE_NAME: "FILE_DATA",
      saveFilesToDB: function (paths, onload, onerror) {
        onload = onload || function () {};
        onerror = onerror || function () {};
        var indexedDB = FS.indexedDB();
        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
          out("creating db");
          var db = openRequest.result;
          db.createObjectStore(FS.DB_STORE_NAME);
        };
        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;
          var transaction = db.transaction([FS.DB_STORE_NAME], "readwrite");
          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0,
            fail = 0,
            total = paths.length;
          function finish() {
            if (fail == 0) onload();else onerror();
          }
          paths.forEach(function (path) {
            var putRequest = files.put(FS.analyzePath(path).object.contents, path);
            putRequest.onsuccess = function putRequest_onsuccess() {
              ok++;
              if (ok + fail == total) finish();
            };
            putRequest.onerror = function putRequest_onerror() {
              fail++;
              if (ok + fail == total) finish();
            };
          });
          transaction.onerror = onerror;
        };
        openRequest.onerror = onerror;
      },
      loadFilesFromDB: function (paths, onload, onerror) {
        onload = onload || function () {};
        onerror = onerror || function () {};
        var indexedDB = FS.indexedDB();
        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        openRequest.onupgradeneeded = onerror;
        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;
          try {
            var transaction = db.transaction([FS.DB_STORE_NAME], "readonly");
          } catch (e) {
            onerror(e);
            return;
          }
          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0,
            fail = 0,
            total = paths.length;
          function finish() {
            if (fail == 0) onload();else onerror();
          }
          paths.forEach(function (path) {
            var getRequest = files.get(path);
            getRequest.onsuccess = function getRequest_onsuccess() {
              if (FS.analyzePath(path).exists) {
                FS.unlink(path);
              }
              FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
              ok++;
              if (ok + fail == total) finish();
            };
            getRequest.onerror = function getRequest_onerror() {
              fail++;
              if (ok + fail == total) finish();
            };
          });
          transaction.onerror = onerror;
        };
        openRequest.onerror = onerror;
      }
    };
    var SYSCALLS = {
      mappings: {},
      DEFAULT_POLLMASK: 5,
      umask: 511,
      calculateAt: function (dirfd, path) {
        if (path[0] !== "/") {
          var dir;
          if (dirfd === -100) {
            dir = FS.cwd();
          } else {
            var dirstream = FS.getStream(dirfd);
            if (!dirstream) throw new FS.ErrnoError(8);
            dir = dirstream.path;
          }
          path = PATH.join2(dir, path);
        }
        return path;
      },
      doStat: function (func, path, buf) {
        try {
          var stat = func(path);
        } catch (e) {
          if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
            return -54;
          }
          throw e;
        }
        HEAP32[buf >> 2] = stat.dev;
        HEAP32[buf + 4 >> 2] = 0;
        HEAP32[buf + 8 >> 2] = stat.ino;
        HEAP32[buf + 12 >> 2] = stat.mode;
        HEAP32[buf + 16 >> 2] = stat.nlink;
        HEAP32[buf + 20 >> 2] = stat.uid;
        HEAP32[buf + 24 >> 2] = stat.gid;
        HEAP32[buf + 28 >> 2] = stat.rdev;
        HEAP32[buf + 32 >> 2] = 0;
        tempI64 = [stat.size >>> 0, (tempDouble = stat.size, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[buf + 40 >> 2] = tempI64[0], HEAP32[buf + 44 >> 2] = tempI64[1];
        HEAP32[buf + 48 >> 2] = 4096;
        HEAP32[buf + 52 >> 2] = stat.blocks;
        HEAP32[buf + 56 >> 2] = stat.atime.getTime() / 1e3 | 0;
        HEAP32[buf + 60 >> 2] = 0;
        HEAP32[buf + 64 >> 2] = stat.mtime.getTime() / 1e3 | 0;
        HEAP32[buf + 68 >> 2] = 0;
        HEAP32[buf + 72 >> 2] = stat.ctime.getTime() / 1e3 | 0;
        HEAP32[buf + 76 >> 2] = 0;
        tempI64 = [stat.ino >>> 0, (tempDouble = stat.ino, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[buf + 80 >> 2] = tempI64[0], HEAP32[buf + 84 >> 2] = tempI64[1];
        return 0;
      },
      doMsync: function (addr, stream, len, flags, offset) {
        var buffer = HEAPU8.slice(addr, addr + len);
        FS.msync(stream, buffer, offset, len, flags);
      },
      doMkdir: function (path, mode) {
        path = PATH.normalize(path);
        if (path[path.length - 1] === "/") path = path.substr(0, path.length - 1);
        FS.mkdir(path, mode, 0);
        return 0;
      },
      doMknod: function (path, mode, dev) {
        switch (mode & 61440) {
          case 32768:
          case 8192:
          case 24576:
          case 4096:
          case 49152:
            break;
          default:
            return -28;
        }
        FS.mknod(path, mode, dev);
        return 0;
      },
      doReadlink: function (path, buf, bufsize) {
        if (bufsize <= 0) return -28;
        var ret = FS.readlink(path);
        var len = Math.min(bufsize, lengthBytesUTF8(ret));
        var endChar = HEAP8[buf + len];
        stringToUTF8(ret, buf, bufsize + 1);
        HEAP8[buf + len] = endChar;
        return len;
      },
      doAccess: function (path, amode) {
        if (amode & ~7) {
          return -28;
        }
        var node;
        var lookup = FS.lookupPath(path, {
          follow: true
        });
        node = lookup.node;
        if (!node) {
          return -44;
        }
        var perms = "";
        if (amode & 4) perms += "r";
        if (amode & 2) perms += "w";
        if (amode & 1) perms += "x";
        if (perms && FS.nodePermissions(node, perms)) {
          return -2;
        }
        return 0;
      },
      doDup: function (path, flags, suggestFD) {
        var suggest = FS.getStream(suggestFD);
        if (suggest) FS.close(suggest);
        return FS.open(path, flags, 0, suggestFD, suggestFD).fd;
      },
      doReadv: function (stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[iov + i * 8 >> 2];
          var len = HEAP32[iov + (i * 8 + 4) >> 2];
          var curr = FS.read(stream, HEAP8, ptr, len, offset);
          if (curr < 0) return -1;
          ret += curr;
          if (curr < len) break;
        }
        return ret;
      },
      doWritev: function (stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[iov + i * 8 >> 2];
          var len = HEAP32[iov + (i * 8 + 4) >> 2];
          var curr = FS.write(stream, HEAP8, ptr, len, offset);
          if (curr < 0) return -1;
          ret += curr;
        }
        return ret;
      },
      varargs: undefined,
      get: function () {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
        return ret;
      },
      getStr: function (ptr) {
        var ret = UTF8ToString(ptr);
        return ret;
      },
      getStreamFromFD: function (fd) {
        var stream = FS.getStream(fd);
        if (!stream) throw new FS.ErrnoError(8);
        return stream;
      },
      get64: function (low, high) {
        return low;
      }
    };
    function ___sys_fcntl64(fd, cmd, varargs) {
      SYSCALLS.varargs = varargs;
      try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        switch (cmd) {
          case 0:
            {
              var arg = SYSCALLS.get();
              if (arg < 0) {
                return -28;
              }
              var newStream;
              newStream = FS.open(stream.path, stream.flags, 0, arg);
              return newStream.fd;
            }
          case 1:
          case 2:
            return 0;
          case 3:
            return stream.flags;
          case 4:
            {
              var arg = SYSCALLS.get();
              stream.flags |= arg;
              return 0;
            }
          case 12:
            {
              var arg = SYSCALLS.get();
              var offset = 0;
              HEAP16[arg + offset >> 1] = 2;
              return 0;
            }
          case 13:
          case 14:
            return 0;
          case 16:
          case 8:
            return -28;
          case 9:
            setErrNo(28);
            return -1;
          default:
            {
              return -28;
            }
        }
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return -e.errno;
      }
    }
    function ___sys_fstat64(fd, buf) {
      try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        return SYSCALLS.doStat(FS.stat, stream.path, buf);
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return -e.errno;
      }
    }
    function ___sys_ioctl(fd, op, varargs) {
      SYSCALLS.varargs = varargs;
      try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        switch (op) {
          case 21509:
          case 21505:
            {
              if (!stream.tty) return -59;
              return 0;
            }
          case 21510:
          case 21511:
          case 21512:
          case 21506:
          case 21507:
          case 21508:
            {
              if (!stream.tty) return -59;
              return 0;
            }
          case 21519:
            {
              if (!stream.tty) return -59;
              var argp = SYSCALLS.get();
              HEAP32[argp >> 2] = 0;
              return 0;
            }
          case 21520:
            {
              if (!stream.tty) return -59;
              return -28;
            }
          case 21531:
            {
              var argp = SYSCALLS.get();
              return FS.ioctl(stream, op, argp);
            }
          case 21523:
            {
              if (!stream.tty) return -59;
              return 0;
            }
          case 21524:
            {
              if (!stream.tty) return -59;
              return 0;
            }
          default:
            abort("bad ioctl syscall " + op);
        }
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return -e.errno;
      }
    }
    function ___sys_madvise1(addr, length, advice) {
      return 0;
    }
    function syscallMmap2(addr, len, prot, flags, fd, off) {
      off <<= 12;
      var ptr;
      var allocated = false;
      if ((flags & 16) !== 0 && addr % 16384 !== 0) {
        return -28;
      }
      if ((flags & 32) !== 0) {
        ptr = _memalign(16384, len);
        if (!ptr) return -48;
        _memset(ptr, 0, len);
        allocated = true;
      } else {
        var info = FS.getStream(fd);
        if (!info) return -8;
        var res = FS.mmap(info, HEAPU8, addr, len, off, prot, flags);
        ptr = res.ptr;
        allocated = res.allocated;
      }
      SYSCALLS.mappings[ptr] = {
        malloc: ptr,
        len: len,
        allocated: allocated,
        fd: fd,
        prot: prot,
        flags: flags,
        offset: off
      };
      return ptr;
    }
    function ___sys_mmap2(addr, len, prot, flags, fd, off) {
      try {
        return syscallMmap2(addr, len, prot, flags, fd, off);
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return -e.errno;
      }
    }
    function syscallMunmap(addr, len) {
      if ((addr | 0) === -1 || len === 0) {
        return -28;
      }
      var info = SYSCALLS.mappings[addr];
      if (!info) return 0;
      if (len === info.len) {
        var stream = FS.getStream(info.fd);
        if (info.prot & 2) {
          SYSCALLS.doMsync(addr, stream, len, info.flags, info.offset);
        }
        FS.munmap(stream);
        SYSCALLS.mappings[addr] = null;
        if (info.allocated) {
          _free(info.malloc);
        }
      }
      return 0;
    }
    function ___sys_munmap(addr, len) {
      try {
        return syscallMunmap(addr, len);
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return -e.errno;
      }
    }
    function ___sys_open(path, flags, varargs) {
      SYSCALLS.varargs = varargs;
      try {
        var pathname = SYSCALLS.getStr(path);
        var mode = SYSCALLS.get();
        var stream = FS.open(pathname, flags, mode);
        return stream.fd;
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return -e.errno;
      }
    }
    function ___sys_stat64(path, buf) {
      try {
        path = SYSCALLS.getStr(path);
        return SYSCALLS.doStat(FS.stat, path, buf);
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return -e.errno;
      }
    }
    function getShiftFromSize(size) {
      switch (size) {
        case 1:
          return 0;
        case 2:
          return 1;
        case 4:
          return 2;
        case 8:
          return 3;
        default:
          throw new TypeError("Unknown type size: " + size);
      }
    }
    function embind_init_charCodes() {
      var codes = new Array(256);
      for (var i = 0; i < 256; ++i) {
        codes[i] = String.fromCharCode(i);
      }
      embind_charCodes = codes;
    }
    var embind_charCodes = undefined;
    function readLatin1String(ptr) {
      var ret = "";
      var c = ptr;
      while (HEAPU8[c]) {
        ret += embind_charCodes[HEAPU8[c++]];
      }
      return ret;
    }
    var awaitingDependencies = {};
    var registeredTypes = {};
    var typeDependencies = {};
    var char_0 = 48;
    var char_9 = 57;
    function makeLegalFunctionName(name) {
      if (undefined === name) {
        return "_unknown";
      }
      name = name.replace(/[^a-zA-Z0-9_]/g, "$");
      var f = name.charCodeAt(0);
      if (f >= char_0 && f <= char_9) {
        return "_" + name;
      } else {
        return name;
      }
    }
    function createNamedFunction(name, body) {
      name = makeLegalFunctionName(name);
      return new Function("body", "return function " + name + "() {\n" + '    "use strict";' + "    return body.apply(this, arguments);\n" + "};\n")(body);
    }
    function extendError(baseErrorType, errorName) {
      var errorClass = createNamedFunction(errorName, function (message) {
        this.name = errorName;
        this.message = message;
        var stack = new Error(message).stack;
        if (stack !== undefined) {
          this.stack = this.toString() + "\n" + stack.replace(/^Error(:[^\n]*)?\n/, "");
        }
      });
      errorClass.prototype = Object.create(baseErrorType.prototype);
      errorClass.prototype.constructor = errorClass;
      errorClass.prototype.toString = function () {
        if (this.message === undefined) {
          return this.name;
        } else {
          return this.name + ": " + this.message;
        }
      };
      return errorClass;
    }
    var BindingError = undefined;
    function throwBindingError(message) {
      throw new BindingError(message);
    }
    var InternalError = undefined;
    function throwInternalError(message) {
      throw new InternalError(message);
    }
    function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
      myTypes.forEach(function (type) {
        typeDependencies[type] = dependentTypes;
      });
      function onComplete(typeConverters) {
        var myTypeConverters = getTypeConverters(typeConverters);
        if (myTypeConverters.length !== myTypes.length) {
          throwInternalError("Mismatched type converter count");
        }
        for (var i = 0; i < myTypes.length; ++i) {
          registerType(myTypes[i], myTypeConverters[i]);
        }
      }
      var typeConverters = new Array(dependentTypes.length);
      var unregisteredTypes = [];
      var registered = 0;
      dependentTypes.forEach(function (dt, i) {
        if (registeredTypes.hasOwnProperty(dt)) {
          typeConverters[i] = registeredTypes[dt];
        } else {
          unregisteredTypes.push(dt);
          if (!awaitingDependencies.hasOwnProperty(dt)) {
            awaitingDependencies[dt] = [];
          }
          awaitingDependencies[dt].push(function () {
            typeConverters[i] = registeredTypes[dt];
            ++registered;
            if (registered === unregisteredTypes.length) {
              onComplete(typeConverters);
            }
          });
        }
      });
      if (0 === unregisteredTypes.length) {
        onComplete(typeConverters);
      }
    }
    function registerType(rawType, registeredInstance, options) {
      options = options || {};
      if (!("argPackAdvance" in registeredInstance)) {
        throw new TypeError("registerType registeredInstance requires argPackAdvance");
      }
      var name = registeredInstance.name;
      if (!rawType) {
        throwBindingError('type "' + name + '" must have a positive integer typeid pointer');
      }
      if (registeredTypes.hasOwnProperty(rawType)) {
        if (options.ignoreDuplicateRegistrations) {
          return;
        } else {
          throwBindingError("Cannot register type '" + name + "' twice");
        }
      }
      registeredTypes[rawType] = registeredInstance;
      delete typeDependencies[rawType];
      if (awaitingDependencies.hasOwnProperty(rawType)) {
        var callbacks = awaitingDependencies[rawType];
        delete awaitingDependencies[rawType];
        callbacks.forEach(function (cb) {
          cb();
        });
      }
    }
    function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
      var shift = getShiftFromSize(size);
      name = readLatin1String(name);
      registerType(rawType, {
        name: name,
        "fromWireType": function (wt) {
          return !!wt;
        },
        "toWireType": function (destructors, o) {
          return o ? trueValue : falseValue;
        },
        "argPackAdvance": 8,
        "readValueFromPointer": function (pointer) {
          var heap;
          if (size === 1) {
            heap = HEAP8;
          } else if (size === 2) {
            heap = HEAP16;
          } else if (size === 4) {
            heap = HEAP32;
          } else {
            throw new TypeError("Unknown boolean type size: " + name);
          }
          return this["fromWireType"](heap[pointer >> shift]);
        },
        destructorFunction: null
      });
    }
    function ClassHandle_isAliasOf(other) {
      if (!(this instanceof ClassHandle)) {
        return false;
      }
      if (!(other instanceof ClassHandle)) {
        return false;
      }
      var leftClass = this.$$.ptrType.registeredClass;
      var left = this.$$.ptr;
      var rightClass = other.$$.ptrType.registeredClass;
      var right = other.$$.ptr;
      while (leftClass.baseClass) {
        left = leftClass.upcast(left);
        leftClass = leftClass.baseClass;
      }
      while (rightClass.baseClass) {
        right = rightClass.upcast(right);
        rightClass = rightClass.baseClass;
      }
      return leftClass === rightClass && left === right;
    }
    function shallowCopyInternalPointer(o) {
      return {
        count: o.count,
        deleteScheduled: o.deleteScheduled,
        preservePointerOnDelete: o.preservePointerOnDelete,
        ptr: o.ptr,
        ptrType: o.ptrType,
        smartPtr: o.smartPtr,
        smartPtrType: o.smartPtrType
      };
    }
    function throwInstanceAlreadyDeleted(obj) {
      function getInstanceTypeName(handle) {
        return handle.$$.ptrType.registeredClass.name;
      }
      throwBindingError(getInstanceTypeName(obj) + " instance already deleted");
    }
    var finalizationGroup = false;
    function detachFinalizer(handle) {}
    function runDestructor($$) {
      if ($$.smartPtr) {
        $$.smartPtrType.rawDestructor($$.smartPtr);
      } else {
        $$.ptrType.registeredClass.rawDestructor($$.ptr);
      }
    }
    function releaseClassHandle($$) {
      $$.count.value -= 1;
      var toDelete = 0 === $$.count.value;
      if (toDelete) {
        runDestructor($$);
      }
    }
    function attachFinalizer(handle) {
      if ("undefined" === typeof FinalizationGroup) {
        attachFinalizer = function (handle) {
          return handle;
        };
        return handle;
      }
      finalizationGroup = new FinalizationGroup(function (iter) {
        for (var result = iter.next(); !result.done; result = iter.next()) {
          var $$ = result.value;
          if (!$$.ptr) {
            console.warn("object already deleted: " + $$.ptr);
          } else {
            releaseClassHandle($$);
          }
        }
      });
      attachFinalizer = function (handle) {
        finalizationGroup.register(handle, handle.$$, handle.$$);
        return handle;
      };
      detachFinalizer = function (handle) {
        finalizationGroup.unregister(handle.$$);
      };
      return attachFinalizer(handle);
    }
    function ClassHandle_clone() {
      if (!this.$$.ptr) {
        throwInstanceAlreadyDeleted(this);
      }
      if (this.$$.preservePointerOnDelete) {
        this.$$.count.value += 1;
        return this;
      } else {
        var clone = attachFinalizer(Object.create(Object.getPrototypeOf(this), {
          $$: {
            value: shallowCopyInternalPointer(this.$$)
          }
        }));
        clone.$$.count.value += 1;
        clone.$$.deleteScheduled = false;
        return clone;
      }
    }
    function ClassHandle_delete() {
      if (!this.$$.ptr) {
        throwInstanceAlreadyDeleted(this);
      }
      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
        throwBindingError("Object already scheduled for deletion");
      }
      detachFinalizer(this);
      releaseClassHandle(this.$$);
      if (!this.$$.preservePointerOnDelete) {
        this.$$.smartPtr = undefined;
        this.$$.ptr = undefined;
      }
    }
    function ClassHandle_isDeleted() {
      return !this.$$.ptr;
    }
    var delayFunction = undefined;
    var deletionQueue = [];
    function flushPendingDeletes() {
      while (deletionQueue.length) {
        var obj = deletionQueue.pop();
        obj.$$.deleteScheduled = false;
        obj["delete"]();
      }
    }
    function ClassHandle_deleteLater() {
      if (!this.$$.ptr) {
        throwInstanceAlreadyDeleted(this);
      }
      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
        throwBindingError("Object already scheduled for deletion");
      }
      deletionQueue.push(this);
      if (deletionQueue.length === 1 && delayFunction) {
        delayFunction(flushPendingDeletes);
      }
      this.$$.deleteScheduled = true;
      return this;
    }
    function init_ClassHandle() {
      ClassHandle.prototype["isAliasOf"] = ClassHandle_isAliasOf;
      ClassHandle.prototype["clone"] = ClassHandle_clone;
      ClassHandle.prototype["delete"] = ClassHandle_delete;
      ClassHandle.prototype["isDeleted"] = ClassHandle_isDeleted;
      ClassHandle.prototype["deleteLater"] = ClassHandle_deleteLater;
    }
    function ClassHandle() {}
    var registeredPointers = {};
    function ensureOverloadTable(proto, methodName, humanName) {
      if (undefined === proto[methodName].overloadTable) {
        var prevFunc = proto[methodName];
        proto[methodName] = function () {
          if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
            throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!");
          }
          return proto[methodName].overloadTable[arguments.length].apply(this, arguments);
        };
        proto[methodName].overloadTable = [];
        proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
      }
    }
    function exposePublicSymbol(name, value, numArguments) {
      if (Module.hasOwnProperty(name)) {
        if (undefined === numArguments || undefined !== Module[name].overloadTable && undefined !== Module[name].overloadTable[numArguments]) {
          throwBindingError("Cannot register public name '" + name + "' twice");
        }
        ensureOverloadTable(Module, name, name);
        if (Module.hasOwnProperty(numArguments)) {
          throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!");
        }
        Module[name].overloadTable[numArguments] = value;
      } else {
        Module[name] = value;
        if (undefined !== numArguments) {
          Module[name].numArguments = numArguments;
        }
      }
    }
    function RegisteredClass(name, constructor, instancePrototype, rawDestructor, baseClass, getActualType, upcast, downcast) {
      this.name = name;
      this.constructor = constructor;
      this.instancePrototype = instancePrototype;
      this.rawDestructor = rawDestructor;
      this.baseClass = baseClass;
      this.getActualType = getActualType;
      this.upcast = upcast;
      this.downcast = downcast;
      this.pureVirtualFunctions = [];
    }
    function upcastPointer(ptr, ptrClass, desiredClass) {
      while (ptrClass !== desiredClass) {
        if (!ptrClass.upcast) {
          throwBindingError("Expected null or instance of " + desiredClass.name + ", got an instance of " + ptrClass.name);
        }
        ptr = ptrClass.upcast(ptr);
        ptrClass = ptrClass.baseClass;
      }
      return ptr;
    }
    function constNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
        if (this.isReference) {
          throwBindingError("null is not a valid " + this.name);
        }
        return 0;
      }
      if (!handle.$$) {
        throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
        throwBindingError("Cannot pass deleted object as a pointer of type " + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }
    function genericPointerToWireType(destructors, handle) {
      var ptr;
      if (handle === null) {
        if (this.isReference) {
          throwBindingError("null is not a valid " + this.name);
        }
        if (this.isSmartPointer) {
          ptr = this.rawConstructor();
          if (destructors !== null) {
            destructors.push(this.rawDestructor, ptr);
          }
          return ptr;
        } else {
          return 0;
        }
      }
      if (!handle.$$) {
        throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
        throwBindingError("Cannot pass deleted object as a pointer of type " + this.name);
      }
      if (!this.isConst && handle.$$.ptrType.isConst) {
        throwBindingError("Cannot convert argument of type " + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + " to parameter type " + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      if (this.isSmartPointer) {
        if (undefined === handle.$$.smartPtr) {
          throwBindingError("Passing raw pointer to smart pointer is illegal");
        }
        switch (this.sharingPolicy) {
          case 0:
            if (handle.$$.smartPtrType === this) {
              ptr = handle.$$.smartPtr;
            } else {
              throwBindingError("Cannot convert argument of type " + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + " to parameter type " + this.name);
            }
            break;
          case 1:
            ptr = handle.$$.smartPtr;
            break;
          case 2:
            if (handle.$$.smartPtrType === this) {
              ptr = handle.$$.smartPtr;
            } else {
              var clonedHandle = handle["clone"]();
              ptr = this.rawShare(ptr, __emval_register(function () {
                clonedHandle["delete"]();
              }));
              if (destructors !== null) {
                destructors.push(this.rawDestructor, ptr);
              }
            }
            break;
          default:
            throwBindingError("Unsupporting sharing policy");
        }
      }
      return ptr;
    }
    function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
        if (this.isReference) {
          throwBindingError("null is not a valid " + this.name);
        }
        return 0;
      }
      if (!handle.$$) {
        throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
        throwBindingError("Cannot pass deleted object as a pointer of type " + this.name);
      }
      if (handle.$$.ptrType.isConst) {
        throwBindingError("Cannot convert argument of type " + handle.$$.ptrType.name + " to parameter type " + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }
    function simpleReadValueFromPointer(pointer) {
      return this["fromWireType"](HEAPU32[pointer >> 2]);
    }
    function RegisteredPointer_getPointee(ptr) {
      if (this.rawGetPointee) {
        ptr = this.rawGetPointee(ptr);
      }
      return ptr;
    }
    function RegisteredPointer_destructor(ptr) {
      if (this.rawDestructor) {
        this.rawDestructor(ptr);
      }
    }
    function RegisteredPointer_deleteObject(handle) {
      if (handle !== null) {
        handle["delete"]();
      }
    }
    function downcastPointer(ptr, ptrClass, desiredClass) {
      if (ptrClass === desiredClass) {
        return ptr;
      }
      if (undefined === desiredClass.baseClass) {
        return null;
      }
      var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass);
      if (rv === null) {
        return null;
      }
      return desiredClass.downcast(rv);
    }
    function getInheritedInstanceCount() {
      return Object.keys(registeredInstances).length;
    }
    function getLiveInheritedInstances() {
      var rv = [];
      for (var k in registeredInstances) {
        if (registeredInstances.hasOwnProperty(k)) {
          rv.push(registeredInstances[k]);
        }
      }
      return rv;
    }
    function setDelayFunction(fn) {
      delayFunction = fn;
      if (deletionQueue.length && delayFunction) {
        delayFunction(flushPendingDeletes);
      }
    }
    function init_embind() {
      Module["getInheritedInstanceCount"] = getInheritedInstanceCount;
      Module["getLiveInheritedInstances"] = getLiveInheritedInstances;
      Module["flushPendingDeletes"] = flushPendingDeletes;
      Module["setDelayFunction"] = setDelayFunction;
    }
    var registeredInstances = {};
    function getBasestPointer(class_, ptr) {
      if (ptr === undefined) {
        throwBindingError("ptr should not be undefined");
      }
      while (class_.baseClass) {
        ptr = class_.upcast(ptr);
        class_ = class_.baseClass;
      }
      return ptr;
    }
    function getInheritedInstance(class_, ptr) {
      ptr = getBasestPointer(class_, ptr);
      return registeredInstances[ptr];
    }
    function makeClassHandle(prototype, record) {
      if (!record.ptrType || !record.ptr) {
        throwInternalError("makeClassHandle requires ptr and ptrType");
      }
      var hasSmartPtrType = !!record.smartPtrType;
      var hasSmartPtr = !!record.smartPtr;
      if (hasSmartPtrType !== hasSmartPtr) {
        throwInternalError("Both smartPtrType and smartPtr must be specified");
      }
      record.count = {
        value: 1
      };
      return attachFinalizer(Object.create(prototype, {
        $$: {
          value: record
        }
      }));
    }
    function RegisteredPointer_fromWireType(ptr) {
      var rawPointer = this.getPointee(ptr);
      if (!rawPointer) {
        this.destructor(ptr);
        return null;
      }
      var registeredInstance = getInheritedInstance(this.registeredClass, rawPointer);
      if (undefined !== registeredInstance) {
        if (0 === registeredInstance.$$.count.value) {
          registeredInstance.$$.ptr = rawPointer;
          registeredInstance.$$.smartPtr = ptr;
          return registeredInstance["clone"]();
        } else {
          var rv = registeredInstance["clone"]();
          this.destructor(ptr);
          return rv;
        }
      }
      function makeDefaultHandle() {
        if (this.isSmartPointer) {
          return makeClassHandle(this.registeredClass.instancePrototype, {
            ptrType: this.pointeeType,
            ptr: rawPointer,
            smartPtrType: this,
            smartPtr: ptr
          });
        } else {
          return makeClassHandle(this.registeredClass.instancePrototype, {
            ptrType: this,
            ptr: ptr
          });
        }
      }
      var actualType = this.registeredClass.getActualType(rawPointer);
      var registeredPointerRecord = registeredPointers[actualType];
      if (!registeredPointerRecord) {
        return makeDefaultHandle.call(this);
      }
      var toType;
      if (this.isConst) {
        toType = registeredPointerRecord.constPointerType;
      } else {
        toType = registeredPointerRecord.pointerType;
      }
      var dp = downcastPointer(rawPointer, this.registeredClass, toType.registeredClass);
      if (dp === null) {
        return makeDefaultHandle.call(this);
      }
      if (this.isSmartPointer) {
        return makeClassHandle(toType.registeredClass.instancePrototype, {
          ptrType: toType,
          ptr: dp,
          smartPtrType: this,
          smartPtr: ptr
        });
      } else {
        return makeClassHandle(toType.registeredClass.instancePrototype, {
          ptrType: toType,
          ptr: dp
        });
      }
    }
    function init_RegisteredPointer() {
      RegisteredPointer.prototype.getPointee = RegisteredPointer_getPointee;
      RegisteredPointer.prototype.destructor = RegisteredPointer_destructor;
      RegisteredPointer.prototype["argPackAdvance"] = 8;
      RegisteredPointer.prototype["readValueFromPointer"] = simpleReadValueFromPointer;
      RegisteredPointer.prototype["deleteObject"] = RegisteredPointer_deleteObject;
      RegisteredPointer.prototype["fromWireType"] = RegisteredPointer_fromWireType;
    }
    function RegisteredPointer(name, registeredClass, isReference, isConst, isSmartPointer, pointeeType, sharingPolicy, rawGetPointee, rawConstructor, rawShare, rawDestructor) {
      this.name = name;
      this.registeredClass = registeredClass;
      this.isReference = isReference;
      this.isConst = isConst;
      this.isSmartPointer = isSmartPointer;
      this.pointeeType = pointeeType;
      this.sharingPolicy = sharingPolicy;
      this.rawGetPointee = rawGetPointee;
      this.rawConstructor = rawConstructor;
      this.rawShare = rawShare;
      this.rawDestructor = rawDestructor;
      if (!isSmartPointer && registeredClass.baseClass === undefined) {
        if (isConst) {
          this["toWireType"] = constNoSmartPtrRawPointerToWireType;
          this.destructorFunction = null;
        } else {
          this["toWireType"] = nonConstNoSmartPtrRawPointerToWireType;
          this.destructorFunction = null;
        }
      } else {
        this["toWireType"] = genericPointerToWireType;
      }
    }
    function replacePublicSymbol(name, value, numArguments) {
      if (!Module.hasOwnProperty(name)) {
        throwInternalError("Replacing nonexistant public symbol");
      }
      if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
        Module[name].overloadTable[numArguments] = value;
      } else {
        Module[name] = value;
        Module[name].argCount = numArguments;
      }
    }
    function embind__requireFunction(signature, rawFunction) {
      signature = readLatin1String(signature);
      function makeDynCaller(dynCall) {
        var args = [];
        for (var i = 1; i < signature.length; ++i) {
          args.push("a" + i);
        }
        var name = "dynCall_" + signature + "_" + rawFunction;
        var body = "return function " + name + "(" + args.join(", ") + ") {\n";
        body += "    return dynCall(rawFunction" + (args.length ? ", " : "") + args.join(", ") + ");\n";
        body += "};\n";
        return new Function("dynCall", "rawFunction", body)(dynCall, rawFunction);
      }
      var dc = Module["dynCall_" + signature];
      var fp = makeDynCaller(dc);
      if (typeof fp !== "function") {
        throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction);
      }
      return fp;
    }
    var UnboundTypeError = undefined;
    function getTypeName(type) {
      var ptr = ___getTypeName(type);
      var rv = readLatin1String(ptr);
      _free(ptr);
      return rv;
    }
    function throwUnboundTypeError(message, types) {
      var unboundTypes = [];
      var seen = {};
      function visit(type) {
        if (seen[type]) {
          return;
        }
        if (registeredTypes[type]) {
          return;
        }
        if (typeDependencies[type]) {
          typeDependencies[type].forEach(visit);
          return;
        }
        unboundTypes.push(type);
        seen[type] = true;
      }
      types.forEach(visit);
      throw new UnboundTypeError(message + ": " + unboundTypes.map(getTypeName).join([", "]));
    }
    function __embind_register_class(rawType, rawPointerType, rawConstPointerType, baseClassRawType, getActualTypeSignature, getActualType, upcastSignature, upcast, downcastSignature, downcast, name, destructorSignature, rawDestructor) {
      name = readLatin1String(name);
      getActualType = embind__requireFunction(getActualTypeSignature, getActualType);
      if (upcast) {
        upcast = embind__requireFunction(upcastSignature, upcast);
      }
      if (downcast) {
        downcast = embind__requireFunction(downcastSignature, downcast);
      }
      rawDestructor = embind__requireFunction(destructorSignature, rawDestructor);
      var legalFunctionName = makeLegalFunctionName(name);
      exposePublicSymbol(legalFunctionName, function () {
        throwUnboundTypeError("Cannot construct " + name + " due to unbound types", [baseClassRawType]);
      });
      whenDependentTypesAreResolved([rawType, rawPointerType, rawConstPointerType], baseClassRawType ? [baseClassRawType] : [], function (base) {
        base = base[0];
        var baseClass;
        var basePrototype;
        if (baseClassRawType) {
          baseClass = base.registeredClass;
          basePrototype = baseClass.instancePrototype;
        } else {
          basePrototype = ClassHandle.prototype;
        }
        var constructor = createNamedFunction(legalFunctionName, function () {
          if (Object.getPrototypeOf(this) !== instancePrototype) {
            throw new BindingError("Use 'new' to construct " + name);
          }
          if (undefined === registeredClass.constructor_body) {
            throw new BindingError(name + " has no accessible constructor");
          }
          var body = registeredClass.constructor_body[arguments.length];
          if (undefined === body) {
            throw new BindingError("Tried to invoke ctor of " + name + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(registeredClass.constructor_body).toString() + ") parameters instead!");
          }
          return body.apply(this, arguments);
        });
        var instancePrototype = Object.create(basePrototype, {
          constructor: {
            value: constructor
          }
        });
        constructor.prototype = instancePrototype;
        var registeredClass = new RegisteredClass(name, constructor, instancePrototype, rawDestructor, baseClass, getActualType, upcast, downcast);
        var referenceConverter = new RegisteredPointer(name, registeredClass, true, false, false);
        var pointerConverter = new RegisteredPointer(name + "*", registeredClass, false, false, false);
        var constPointerConverter = new RegisteredPointer(name + " const*", registeredClass, false, true, false);
        registeredPointers[rawType] = {
          pointerType: pointerConverter,
          constPointerType: constPointerConverter
        };
        replacePublicSymbol(legalFunctionName, constructor);
        return [referenceConverter, pointerConverter, constPointerConverter];
      });
    }
    function heap32VectorToArray(count, firstElement) {
      var array = [];
      for (var i = 0; i < count; i++) {
        array.push(HEAP32[(firstElement >> 2) + i]);
      }
      return array;
    }
    function runDestructors(destructors) {
      while (destructors.length) {
        var ptr = destructors.pop();
        var del = destructors.pop();
        del(ptr);
      }
    }
    function __embind_register_class_constructor(rawClassType, argCount, rawArgTypesAddr, invokerSignature, invoker, rawConstructor) {
      assert(argCount > 0);
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      invoker = embind__requireFunction(invokerSignature, invoker);
      var args = [rawConstructor];
      var destructors = [];
      whenDependentTypesAreResolved([], [rawClassType], function (classType) {
        classType = classType[0];
        var humanName = "constructor " + classType.name;
        if (undefined === classType.registeredClass.constructor_body) {
          classType.registeredClass.constructor_body = [];
        }
        if (undefined !== classType.registeredClass.constructor_body[argCount - 1]) {
          throw new BindingError("Cannot register multiple constructors with identical number of parameters (" + (argCount - 1) + ") for class '" + classType.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!");
        }
        classType.registeredClass.constructor_body[argCount - 1] = function unboundTypeHandler() {
          throwUnboundTypeError("Cannot construct " + classType.name + " due to unbound types", rawArgTypes);
        };
        whenDependentTypesAreResolved([], rawArgTypes, function (argTypes) {
          classType.registeredClass.constructor_body[argCount - 1] = function constructor_body() {
            if (arguments.length !== argCount - 1) {
              throwBindingError(humanName + " called with " + arguments.length + " arguments, expected " + (argCount - 1));
            }
            destructors.length = 0;
            args.length = argCount;
            for (var i = 1; i < argCount; ++i) {
              args[i] = argTypes[i]["toWireType"](destructors, arguments[i - 1]);
            }
            var ptr = invoker.apply(null, args);
            runDestructors(destructors);
            return argTypes[0]["fromWireType"](ptr);
          };
          return [];
        });
        return [];
      });
    }
    function new_(constructor, argumentList) {
      if (!(constructor instanceof Function)) {
        throw new TypeError("new_ called with constructor type " + typeof constructor + " which is not a function");
      }
      var dummy = createNamedFunction(constructor.name || "unknownFunctionName", function () {});
      dummy.prototype = constructor.prototype;
      var obj = new dummy();
      var r = constructor.apply(obj, argumentList);
      return r instanceof Object ? r : obj;
    }
    function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc) {
      var argCount = argTypes.length;
      if (argCount < 2) {
        throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!");
      }
      var isClassMethodFunc = argTypes[1] !== null && classType !== null;
      var needsDestructorStack = false;
      for (var i = 1; i < argTypes.length; ++i) {
        if (argTypes[i] !== null && argTypes[i].destructorFunction === undefined) {
          needsDestructorStack = true;
          break;
        }
      }
      var returns = argTypes[0].name !== "void";
      var argsList = "";
      var argsListWired = "";
      for (var i = 0; i < argCount - 2; ++i) {
        argsList += (i !== 0 ? ", " : "") + "arg" + i;
        argsListWired += (i !== 0 ? ", " : "") + "arg" + i + "Wired";
      }
      var invokerFnBody = "return function " + makeLegalFunctionName(humanName) + "(" + argsList + ") {\n" + "if (arguments.length !== " + (argCount - 2) + ") {\n" + "throwBindingError('function " + humanName + " called with ' + arguments.length + ' arguments, expected " + (argCount - 2) + " args!');\n" + "}\n";
      if (needsDestructorStack) {
        invokerFnBody += "var destructors = [];\n";
      }
      var dtorStack = needsDestructorStack ? "destructors" : "null";
      var args1 = ["throwBindingError", "invoker", "fn", "runDestructors", "retType", "classParam"];
      var args2 = [throwBindingError, cppInvokerFunc, cppTargetFunc, runDestructors, argTypes[0], argTypes[1]];
      if (isClassMethodFunc) {
        invokerFnBody += "var thisWired = classParam.toWireType(" + dtorStack + ", this);\n";
      }
      for (var i = 0; i < argCount - 2; ++i) {
        invokerFnBody += "var arg" + i + "Wired = argType" + i + ".toWireType(" + dtorStack + ", arg" + i + "); // " + argTypes[i + 2].name + "\n";
        args1.push("argType" + i);
        args2.push(argTypes[i + 2]);
      }
      if (isClassMethodFunc) {
        argsListWired = "thisWired" + (argsListWired.length > 0 ? ", " : "") + argsListWired;
      }
      invokerFnBody += (returns ? "var rv = " : "") + "invoker(fn" + (argsListWired.length > 0 ? ", " : "") + argsListWired + ");\n";
      if (needsDestructorStack) {
        invokerFnBody += "runDestructors(destructors);\n";
      } else {
        for (var i = isClassMethodFunc ? 1 : 2; i < argTypes.length; ++i) {
          var paramName = i === 1 ? "thisWired" : "arg" + (i - 2) + "Wired";
          if (argTypes[i].destructorFunction !== null) {
            invokerFnBody += paramName + "_dtor(" + paramName + "); // " + argTypes[i].name + "\n";
            args1.push(paramName + "_dtor");
            args2.push(argTypes[i].destructorFunction);
          }
        }
      }
      if (returns) {
        invokerFnBody += "var ret = retType.fromWireType(rv);\n" + "return ret;\n";
      } else {}
      invokerFnBody += "}\n";
      args1.push(invokerFnBody);
      var invokerFunction = new_(Function, args1).apply(null, args2);
      return invokerFunction;
    }
    function __embind_register_class_function(rawClassType, methodName, argCount, rawArgTypesAddr, invokerSignature, rawInvoker, context, isPureVirtual) {
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      methodName = readLatin1String(methodName);
      rawInvoker = embind__requireFunction(invokerSignature, rawInvoker);
      whenDependentTypesAreResolved([], [rawClassType], function (classType) {
        classType = classType[0];
        var humanName = classType.name + "." + methodName;
        if (isPureVirtual) {
          classType.registeredClass.pureVirtualFunctions.push(methodName);
        }
        function unboundTypesHandler() {
          throwUnboundTypeError("Cannot call " + humanName + " due to unbound types", rawArgTypes);
        }
        var proto = classType.registeredClass.instancePrototype;
        var method = proto[methodName];
        if (undefined === method || undefined === method.overloadTable && method.className !== classType.name && method.argCount === argCount - 2) {
          unboundTypesHandler.argCount = argCount - 2;
          unboundTypesHandler.className = classType.name;
          proto[methodName] = unboundTypesHandler;
        } else {
          ensureOverloadTable(proto, methodName, humanName);
          proto[methodName].overloadTable[argCount - 2] = unboundTypesHandler;
        }
        whenDependentTypesAreResolved([], rawArgTypes, function (argTypes) {
          var memberFunction = craftInvokerFunction(humanName, argTypes, classType, rawInvoker, context);
          if (undefined === proto[methodName].overloadTable) {
            memberFunction.argCount = argCount - 2;
            proto[methodName] = memberFunction;
          } else {
            proto[methodName].overloadTable[argCount - 2] = memberFunction;
          }
          return [];
        });
        return [];
      });
    }
    var emval_free_list = [];
    var emval_handle_array = [{}, {
      value: undefined
    }, {
      value: null
    }, {
      value: true
    }, {
      value: false
    }];
    function __emval_decref(handle) {
      if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
        emval_handle_array[handle] = undefined;
        emval_free_list.push(handle);
      }
    }
    function count_emval_handles() {
      var count = 0;
      for (var i = 5; i < emval_handle_array.length; ++i) {
        if (emval_handle_array[i] !== undefined) {
          ++count;
        }
      }
      return count;
    }
    function get_first_emval() {
      for (var i = 5; i < emval_handle_array.length; ++i) {
        if (emval_handle_array[i] !== undefined) {
          return emval_handle_array[i];
        }
      }
      return null;
    }
    function init_emval() {
      Module["count_emval_handles"] = count_emval_handles;
      Module["get_first_emval"] = get_first_emval;
    }
    function __emval_register(value) {
      switch (value) {
        case undefined:
          {
            return 1;
          }
        case null:
          {
            return 2;
          }
        case true:
          {
            return 3;
          }
        case false:
          {
            return 4;
          }
        default:
          {
            var handle = emval_free_list.length ? emval_free_list.pop() : emval_handle_array.length;
            emval_handle_array[handle] = {
              refcount: 1,
              value: value
            };
            return handle;
          }
      }
    }
    function __embind_register_emval(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
        name: name,
        "fromWireType": function (handle) {
          var rv = emval_handle_array[handle].value;
          __emval_decref(handle);
          return rv;
        },
        "toWireType": function (destructors, value) {
          return __emval_register(value);
        },
        "argPackAdvance": 8,
        "readValueFromPointer": simpleReadValueFromPointer,
        destructorFunction: null
      });
    }
    function enumReadValueFromPointer(name, shift, signed) {
      switch (shift) {
        case 0:
          return function (pointer) {
            var heap = signed ? HEAP8 : HEAPU8;
            return this["fromWireType"](heap[pointer]);
          };
        case 1:
          return function (pointer) {
            var heap = signed ? HEAP16 : HEAPU16;
            return this["fromWireType"](heap[pointer >> 1]);
          };
        case 2:
          return function (pointer) {
            var heap = signed ? HEAP32 : HEAPU32;
            return this["fromWireType"](heap[pointer >> 2]);
          };
        default:
          throw new TypeError("Unknown integer type: " + name);
      }
    }
    function __embind_register_enum(rawType, name, size, isSigned) {
      var shift = getShiftFromSize(size);
      name = readLatin1String(name);
      function ctor() {}
      ctor.values = {};
      registerType(rawType, {
        name: name,
        constructor: ctor,
        "fromWireType": function (c) {
          return this.constructor.values[c];
        },
        "toWireType": function (destructors, c) {
          return c.value;
        },
        "argPackAdvance": 8,
        "readValueFromPointer": enumReadValueFromPointer(name, shift, isSigned),
        destructorFunction: null
      });
      exposePublicSymbol(name, ctor);
    }
    function requireRegisteredType(rawType, humanName) {
      var impl = registeredTypes[rawType];
      if (undefined === impl) {
        throwBindingError(humanName + " has unknown type " + getTypeName(rawType));
      }
      return impl;
    }
    function __embind_register_enum_value(rawEnumType, name, enumValue) {
      var enumType = requireRegisteredType(rawEnumType, "enum");
      name = readLatin1String(name);
      var Enum = enumType.constructor;
      var Value = Object.create(enumType.constructor.prototype, {
        value: {
          value: enumValue
        },
        constructor: {
          value: createNamedFunction(enumType.name + "_" + name, function () {})
        }
      });
      Enum.values[enumValue] = Value;
      Enum[name] = Value;
    }
    function _embind_repr(v) {
      if (v === null) {
        return "null";
      }
      var t = typeof v;
      if (t === "object" || t === "array" || t === "function") {
        return v.toString();
      } else {
        return "" + v;
      }
    }
    function floatReadValueFromPointer(name, shift) {
      switch (shift) {
        case 2:
          return function (pointer) {
            return this["fromWireType"](HEAPF32[pointer >> 2]);
          };
        case 3:
          return function (pointer) {
            return this["fromWireType"](HEAPF64[pointer >> 3]);
          };
        default:
          throw new TypeError("Unknown float type: " + name);
      }
    }
    function __embind_register_float(rawType, name, size) {
      var shift = getShiftFromSize(size);
      name = readLatin1String(name);
      registerType(rawType, {
        name: name,
        "fromWireType": function (value) {
          return value;
        },
        "toWireType": function (destructors, value) {
          if (typeof value !== "number" && typeof value !== "boolean") {
            throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
          }
          return value;
        },
        "argPackAdvance": 8,
        "readValueFromPointer": floatReadValueFromPointer(name, shift),
        destructorFunction: null
      });
    }
    function __embind_register_function(name, argCount, rawArgTypesAddr, signature, rawInvoker, fn) {
      var argTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      name = readLatin1String(name);
      rawInvoker = embind__requireFunction(signature, rawInvoker);
      exposePublicSymbol(name, function () {
        throwUnboundTypeError("Cannot call " + name + " due to unbound types", argTypes);
      }, argCount - 1);
      whenDependentTypesAreResolved([], argTypes, function (argTypes) {
        var invokerArgsArray = [argTypes[0], null].concat(argTypes.slice(1));
        replacePublicSymbol(name, craftInvokerFunction(name, invokerArgsArray, null, rawInvoker, fn), argCount - 1);
        return [];
      });
    }
    function integerReadValueFromPointer(name, shift, signed) {
      switch (shift) {
        case 0:
          return signed ? function readS8FromPointer(pointer) {
            return HEAP8[pointer];
          } : function readU8FromPointer(pointer) {
            return HEAPU8[pointer];
          };
        case 1:
          return signed ? function readS16FromPointer(pointer) {
            return HEAP16[pointer >> 1];
          } : function readU16FromPointer(pointer) {
            return HEAPU16[pointer >> 1];
          };
        case 2:
          return signed ? function readS32FromPointer(pointer) {
            return HEAP32[pointer >> 2];
          } : function readU32FromPointer(pointer) {
            return HEAPU32[pointer >> 2];
          };
        default:
          throw new TypeError("Unknown integer type: " + name);
      }
    }
    function __embind_register_integer(primitiveType, name, size, minRange, maxRange) {
      name = readLatin1String(name);
      if (maxRange === -1) {
        maxRange = 4294967295;
      }
      var shift = getShiftFromSize(size);
      var fromWireType = function (value) {
        return value;
      };
      if (minRange === 0) {
        var bitshift = 32 - 8 * size;
        fromWireType = function (value) {
          return value << bitshift >>> bitshift;
        };
      }
      var isUnsignedType = name.indexOf("unsigned") != -1;
      registerType(primitiveType, {
        name: name,
        "fromWireType": fromWireType,
        "toWireType": function (destructors, value) {
          if (typeof value !== "number" && typeof value !== "boolean") {
            throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
          }
          if (value < minRange || value > maxRange) {
            throw new TypeError('Passing a number "' + _embind_repr(value) + '" from JS side to C/C++ side to an argument of type "' + name + '", which is outside the valid range [' + minRange + ", " + maxRange + "]!");
          }
          return isUnsignedType ? value >>> 0 : value | 0;
        },
        "argPackAdvance": 8,
        "readValueFromPointer": integerReadValueFromPointer(name, shift, minRange !== 0),
        destructorFunction: null
      });
    }
    function __embind_register_memory_view(rawType, dataTypeIndex, name) {
      var typeMapping = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array];
      var TA = typeMapping[dataTypeIndex];
      function decodeMemoryView(handle) {
        handle = handle >> 2;
        var heap = HEAPU32;
        var size = heap[handle];
        var data = heap[handle + 1];
        return new TA(buffer, data, size);
      }
      name = readLatin1String(name);
      registerType(rawType, {
        name: name,
        "fromWireType": decodeMemoryView,
        "argPackAdvance": 8,
        "readValueFromPointer": decodeMemoryView
      }, {
        ignoreDuplicateRegistrations: true
      });
    }
    function __embind_register_std_string(rawType, name) {
      name = readLatin1String(name);
      var stdStringIsUTF8 = name === "std::string";
      registerType(rawType, {
        name: name,
        "fromWireType": function (value) {
          var length = HEAPU32[value >> 2];
          var str;
          if (stdStringIsUTF8) {
            var decodeStartPtr = value + 4;
            for (var i = 0; i <= length; ++i) {
              var currentBytePtr = value + 4 + i;
              if (HEAPU8[currentBytePtr] == 0 || i == length) {
                var maxRead = currentBytePtr - decodeStartPtr;
                var stringSegment = UTF8ToString(decodeStartPtr, maxRead);
                if (str === undefined) {
                  str = stringSegment;
                } else {
                  str += String.fromCharCode(0);
                  str += stringSegment;
                }
                decodeStartPtr = currentBytePtr + 1;
              }
            }
          } else {
            var a = new Array(length);
            for (var i = 0; i < length; ++i) {
              a[i] = String.fromCharCode(HEAPU8[value + 4 + i]);
            }
            str = a.join("");
          }
          _free(value);
          return str;
        },
        "toWireType": function (destructors, value) {
          if (value instanceof ArrayBuffer) {
            value = new Uint8Array(value);
          }
          var getLength;
          var valueIsOfTypeString = typeof value === "string";
          if (!(valueIsOfTypeString || value instanceof Uint8Array || value instanceof Uint8ClampedArray || value instanceof Int8Array)) {
            throwBindingError("Cannot pass non-string to std::string");
          }
          if (stdStringIsUTF8 && valueIsOfTypeString) {
            getLength = function () {
              return lengthBytesUTF8(value);
            };
          } else {
            getLength = function () {
              return value.length;
            };
          }
          var length = getLength();
          var ptr = _malloc(4 + length + 1);
          HEAPU32[ptr >> 2] = length;
          if (stdStringIsUTF8 && valueIsOfTypeString) {
            stringToUTF8(value, ptr + 4, length + 1);
          } else {
            if (valueIsOfTypeString) {
              for (var i = 0; i < length; ++i) {
                var charCode = value.charCodeAt(i);
                if (charCode > 255) {
                  _free(ptr);
                  throwBindingError("String has UTF-16 code units that do not fit in 8 bits");
                }
                HEAPU8[ptr + 4 + i] = charCode;
              }
            } else {
              for (var i = 0; i < length; ++i) {
                HEAPU8[ptr + 4 + i] = value[i];
              }
            }
          }
          if (destructors !== null) {
            destructors.push(_free, ptr);
          }
          return ptr;
        },
        "argPackAdvance": 8,
        "readValueFromPointer": simpleReadValueFromPointer,
        destructorFunction: function (ptr) {
          _free(ptr);
        }
      });
    }
    function __embind_register_std_wstring(rawType, charSize, name) {
      name = readLatin1String(name);
      var decodeString, encodeString, getHeap, lengthBytesUTF, shift;
      if (charSize === 2) {
        decodeString = UTF16ToString;
        encodeString = stringToUTF16;
        lengthBytesUTF = lengthBytesUTF16;
        getHeap = function () {
          return HEAPU16;
        };
        shift = 1;
      } else if (charSize === 4) {
        decodeString = UTF32ToString;
        encodeString = stringToUTF32;
        lengthBytesUTF = lengthBytesUTF32;
        getHeap = function () {
          return HEAPU32;
        };
        shift = 2;
      }
      registerType(rawType, {
        name: name,
        "fromWireType": function (value) {
          var length = HEAPU32[value >> 2];
          var HEAP = getHeap();
          var str;
          var decodeStartPtr = value + 4;
          for (var i = 0; i <= length; ++i) {
            var currentBytePtr = value + 4 + i * charSize;
            if (HEAP[currentBytePtr >> shift] == 0 || i == length) {
              var maxReadBytes = currentBytePtr - decodeStartPtr;
              var stringSegment = decodeString(decodeStartPtr, maxReadBytes);
              if (str === undefined) {
                str = stringSegment;
              } else {
                str += String.fromCharCode(0);
                str += stringSegment;
              }
              decodeStartPtr = currentBytePtr + charSize;
            }
          }
          _free(value);
          return str;
        },
        "toWireType": function (destructors, value) {
          if (!(typeof value === "string")) {
            throwBindingError("Cannot pass non-string to C++ string type " + name);
          }
          var length = lengthBytesUTF(value);
          var ptr = _malloc(4 + length + charSize);
          HEAPU32[ptr >> 2] = length >> shift;
          encodeString(value, ptr + 4, length + charSize);
          if (destructors !== null) {
            destructors.push(_free, ptr);
          }
          return ptr;
        },
        "argPackAdvance": 8,
        "readValueFromPointer": simpleReadValueFromPointer,
        destructorFunction: function (ptr) {
          _free(ptr);
        }
      });
    }
    function __embind_register_void(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
        isVoid: true,
        name: name,
        "argPackAdvance": 0,
        "fromWireType": function () {
          return undefined;
        },
        "toWireType": function (destructors, o) {
          return undefined;
        }
      });
    }
    function _abort() {
      abort();
    }
    var _emscripten_get_now;
    _emscripten_get_now = function () {
      return performance.now();
    };
    var _emscripten_get_now_is_monotonic = true;
    function _clock_gettime(clk_id, tp) {
      var now;
      if (clk_id === 0) {
        now = Date.now();
      } else if ((clk_id === 1 || clk_id === 4) && _emscripten_get_now_is_monotonic) {
        now = _emscripten_get_now();
      } else {
        setErrNo(28);
        return -1;
      }
      HEAP32[tp >> 2] = now / 1e3 | 0;
      HEAP32[tp + 4 >> 2] = now % 1e3 * 1e3 * 1e3 | 0;
      return 0;
    }
    function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.copyWithin(dest, src, src + num);
    }
    function _emscripten_get_heap_size() {
      return HEAPU8.length;
    }
    function emscripten_realloc_buffer(size) {
      try {
        wasmMemory.grow(size - buffer.byteLength + 65535 >>> 16);
        updateGlobalBufferAndViews(wasmMemory.buffer);
        return 1;
      } catch (e) {}
    }
    function _emscripten_resize_heap(requestedSize) {
      requestedSize = requestedSize >>> 0;
      var oldSize = _emscripten_get_heap_size();
      var PAGE_MULTIPLE = 65536;
      var maxHeapSize = 1073741824;
      if (requestedSize > maxHeapSize) {
        return false;
      }
      var minHeapSize = 16777216;
      for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
        var overGrownHeapSize = oldSize * (1 + .2 / cutDown);
        overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
        var newSize = Math.min(maxHeapSize, alignUp(Math.max(minHeapSize, requestedSize, overGrownHeapSize), PAGE_MULTIPLE));
        var replacement = emscripten_realloc_buffer(newSize);
        if (replacement) {
          return true;
        }
      }
      return false;
    }
    var ENV = {};
    function __getExecutableName() {
      return thisProgram || "./this.program";
    }
    function getEnvStrings() {
      if (!getEnvStrings.strings) {
        var env = {
          "USER": "web_user",
          "LOGNAME": "web_user",
          "PATH": "/",
          "PWD": "/",
          "HOME": "/home/web_user",
          "LANG": (typeof navigator === "object" && navigator.languages && navigator.languages[0] || "C").replace("-", "_") + ".UTF-8",
          "_": __getExecutableName()
        };
        for (var x in ENV) {
          env[x] = ENV[x];
        }
        var strings = [];
        for (var x in env) {
          strings.push(x + "=" + env[x]);
        }
        getEnvStrings.strings = strings;
      }
      return getEnvStrings.strings;
    }
    function _environ_get(__environ, environ_buf) {
      var bufSize = 0;
      getEnvStrings().forEach(function (string, i) {
        var ptr = environ_buf + bufSize;
        HEAP32[__environ + i * 4 >> 2] = ptr;
        writeAsciiToMemory(string, ptr);
        bufSize += string.length + 1;
      });
      return 0;
    }
    function _environ_sizes_get(penviron_count, penviron_buf_size) {
      var strings = getEnvStrings();
      HEAP32[penviron_count >> 2] = strings.length;
      var bufSize = 0;
      strings.forEach(function (string) {
        bufSize += string.length + 1;
      });
      HEAP32[penviron_buf_size >> 2] = bufSize;
      return 0;
    }
    function _exit(status) {
      exit(status);
    }
    function _fd_close(fd) {
      try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        FS.close(stream);
        return 0;
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return e.errno;
      }
    }
    function _fd_fdstat_get(fd, pbuf) {
      try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        var type = stream.tty ? 2 : FS.isDir(stream.mode) ? 3 : FS.isLink(stream.mode) ? 7 : 4;
        HEAP8[pbuf >> 0] = type;
        return 0;
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return e.errno;
      }
    }
    function _fd_read(fd, iov, iovcnt, pnum) {
      try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        var num = SYSCALLS.doReadv(stream, iov, iovcnt);
        HEAP32[pnum >> 2] = num;
        return 0;
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return e.errno;
      }
    }
    function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {
      try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        var HIGH_OFFSET = 4294967296;
        var offset = offset_high * HIGH_OFFSET + (offset_low >>> 0);
        var DOUBLE_LIMIT = 9007199254740992;
        if (offset <= -DOUBLE_LIMIT || offset >= DOUBLE_LIMIT) {
          return -61;
        }
        FS.llseek(stream, offset, whence);
        tempI64 = [stream.position >>> 0, (tempDouble = stream.position, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[newOffset >> 2] = tempI64[0], HEAP32[newOffset + 4 >> 2] = tempI64[1];
        if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
        return 0;
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return e.errno;
      }
    }
    function _fd_write(fd, iov, iovcnt, pnum) {
      try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        var num = SYSCALLS.doWritev(stream, iov, iovcnt);
        HEAP32[pnum >> 2] = num;
        return 0;
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return e.errno;
      }
    }
    function _pthread_create() {
      return 6;
    }
    function _pthread_detach() {}
    function _pthread_join() {}
    function _setTempRet0($i) {
      setTempRet0($i | 0);
    }
    function __isLeapYear(year) {
      return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    }
    function __arraySum(array, index) {
      var sum = 0;
      for (var i = 0; i <= index; sum += array[i++]) {}
      return sum;
    }
    var __MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var __MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    function __addDays(date, days) {
      var newDate = new Date(date.getTime());
      while (days > 0) {
        var leap = __isLeapYear(newDate.getFullYear());
        var currentMonth = newDate.getMonth();
        var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[currentMonth];
        if (days > daysInCurrentMonth - newDate.getDate()) {
          days -= daysInCurrentMonth - newDate.getDate() + 1;
          newDate.setDate(1);
          if (currentMonth < 11) {
            newDate.setMonth(currentMonth + 1);
          } else {
            newDate.setMonth(0);
            newDate.setFullYear(newDate.getFullYear() + 1);
          }
        } else {
          newDate.setDate(newDate.getDate() + days);
          return newDate;
        }
      }
      return newDate;
    }
    function _strftime(s, maxsize, format, tm) {
      var tm_zone = HEAP32[tm + 40 >> 2];
      var date = {
        tm_sec: HEAP32[tm >> 2],
        tm_min: HEAP32[tm + 4 >> 2],
        tm_hour: HEAP32[tm + 8 >> 2],
        tm_mday: HEAP32[tm + 12 >> 2],
        tm_mon: HEAP32[tm + 16 >> 2],
        tm_year: HEAP32[tm + 20 >> 2],
        tm_wday: HEAP32[tm + 24 >> 2],
        tm_yday: HEAP32[tm + 28 >> 2],
        tm_isdst: HEAP32[tm + 32 >> 2],
        tm_gmtoff: HEAP32[tm + 36 >> 2],
        tm_zone: tm_zone ? UTF8ToString(tm_zone) : ""
      };
      var pattern = UTF8ToString(format);
      var EXPANSION_RULES_1 = {
        "%c": "%a %b %d %H:%M:%S %Y",
        "%D": "%m/%d/%y",
        "%F": "%Y-%m-%d",
        "%h": "%b",
        "%r": "%I:%M:%S %p",
        "%R": "%H:%M",
        "%T": "%H:%M:%S",
        "%x": "%m/%d/%y",
        "%X": "%H:%M:%S",
        "%Ec": "%c",
        "%EC": "%C",
        "%Ex": "%m/%d/%y",
        "%EX": "%H:%M:%S",
        "%Ey": "%y",
        "%EY": "%Y",
        "%Od": "%d",
        "%Oe": "%e",
        "%OH": "%H",
        "%OI": "%I",
        "%Om": "%m",
        "%OM": "%M",
        "%OS": "%S",
        "%Ou": "%u",
        "%OU": "%U",
        "%OV": "%V",
        "%Ow": "%w",
        "%OW": "%W",
        "%Oy": "%y"
      };
      for (var rule in EXPANSION_RULES_1) {
        pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_1[rule]);
      }
      var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      function leadingSomething(value, digits, character) {
        var str = typeof value === "number" ? value.toString() : value || "";
        while (str.length < digits) {
          str = character[0] + str;
        }
        return str;
      }
      function leadingNulls(value, digits) {
        return leadingSomething(value, digits, "0");
      }
      function compareByDay(date1, date2) {
        function sgn(value) {
          return value < 0 ? -1 : value > 0 ? 1 : 0;
        }
        var compare;
        if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
          if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
            compare = sgn(date1.getDate() - date2.getDate());
          }
        }
        return compare;
      }
      function getFirstWeekStartDate(janFourth) {
        switch (janFourth.getDay()) {
          case 0:
            return new Date(janFourth.getFullYear() - 1, 11, 29);
          case 1:
            return janFourth;
          case 2:
            return new Date(janFourth.getFullYear(), 0, 3);
          case 3:
            return new Date(janFourth.getFullYear(), 0, 2);
          case 4:
            return new Date(janFourth.getFullYear(), 0, 1);
          case 5:
            return new Date(janFourth.getFullYear() - 1, 11, 31);
          case 6:
            return new Date(janFourth.getFullYear() - 1, 11, 30);
        }
      }
      function getWeekBasedYear(date) {
        var thisDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
        var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
        var janFourthNextYear = new Date(thisDate.getFullYear() + 1, 0, 4);
        var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
        var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
        if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
          if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
            return thisDate.getFullYear() + 1;
          } else {
            return thisDate.getFullYear();
          }
        } else {
          return thisDate.getFullYear() - 1;
        }
      }
      var EXPANSION_RULES_2 = {
        "%a": function (date) {
          return WEEKDAYS[date.tm_wday].substring(0, 3);
        },
        "%A": function (date) {
          return WEEKDAYS[date.tm_wday];
        },
        "%b": function (date) {
          return MONTHS[date.tm_mon].substring(0, 3);
        },
        "%B": function (date) {
          return MONTHS[date.tm_mon];
        },
        "%C": function (date) {
          var year = date.tm_year + 1900;
          return leadingNulls(year / 100 | 0, 2);
        },
        "%d": function (date) {
          return leadingNulls(date.tm_mday, 2);
        },
        "%e": function (date) {
          return leadingSomething(date.tm_mday, 2, " ");
        },
        "%g": function (date) {
          return getWeekBasedYear(date).toString().substring(2);
        },
        "%G": function (date) {
          return getWeekBasedYear(date);
        },
        "%H": function (date) {
          return leadingNulls(date.tm_hour, 2);
        },
        "%I": function (date) {
          var twelveHour = date.tm_hour;
          if (twelveHour == 0) twelveHour = 12;else if (twelveHour > 12) twelveHour -= 12;
          return leadingNulls(twelveHour, 2);
        },
        "%j": function (date) {
          return leadingNulls(date.tm_mday + __arraySum(__isLeapYear(date.tm_year + 1900) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, date.tm_mon - 1), 3);
        },
        "%m": function (date) {
          return leadingNulls(date.tm_mon + 1, 2);
        },
        "%M": function (date) {
          return leadingNulls(date.tm_min, 2);
        },
        "%n": function () {
          return "\n";
        },
        "%p": function (date) {
          if (date.tm_hour >= 0 && date.tm_hour < 12) {
            return "AM";
          } else {
            return "PM";
          }
        },
        "%S": function (date) {
          return leadingNulls(date.tm_sec, 2);
        },
        "%t": function () {
          return "\t";
        },
        "%u": function (date) {
          return date.tm_wday || 7;
        },
        "%U": function (date) {
          var janFirst = new Date(date.tm_year + 1900, 0, 1);
          var firstSunday = janFirst.getDay() === 0 ? janFirst : __addDays(janFirst, 7 - janFirst.getDay());
          var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);
          if (compareByDay(firstSunday, endDate) < 0) {
            var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
            var firstSundayUntilEndJanuary = 31 - firstSunday.getDate();
            var days = firstSundayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
            return leadingNulls(Math.ceil(days / 7), 2);
          }
          return compareByDay(firstSunday, janFirst) === 0 ? "01" : "00";
        },
        "%V": function (date) {
          var janFourthThisYear = new Date(date.tm_year + 1900, 0, 4);
          var janFourthNextYear = new Date(date.tm_year + 1901, 0, 4);
          var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
          var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
          var endDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
          if (compareByDay(endDate, firstWeekStartThisYear) < 0) {
            return "53";
          }
          if (compareByDay(firstWeekStartNextYear, endDate) <= 0) {
            return "01";
          }
          var daysDifference;
          if (firstWeekStartThisYear.getFullYear() < date.tm_year + 1900) {
            daysDifference = date.tm_yday + 32 - firstWeekStartThisYear.getDate();
          } else {
            daysDifference = date.tm_yday + 1 - firstWeekStartThisYear.getDate();
          }
          return leadingNulls(Math.ceil(daysDifference / 7), 2);
        },
        "%w": function (date) {
          return date.tm_wday;
        },
        "%W": function (date) {
          var janFirst = new Date(date.tm_year, 0, 1);
          var firstMonday = janFirst.getDay() === 1 ? janFirst : __addDays(janFirst, janFirst.getDay() === 0 ? 1 : 7 - janFirst.getDay() + 1);
          var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);
          if (compareByDay(firstMonday, endDate) < 0) {
            var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
            var firstMondayUntilEndJanuary = 31 - firstMonday.getDate();
            var days = firstMondayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
            return leadingNulls(Math.ceil(days / 7), 2);
          }
          return compareByDay(firstMonday, janFirst) === 0 ? "01" : "00";
        },
        "%y": function (date) {
          return (date.tm_year + 1900).toString().substring(2);
        },
        "%Y": function (date) {
          return date.tm_year + 1900;
        },
        "%z": function (date) {
          var off = date.tm_gmtoff;
          var ahead = off >= 0;
          off = Math.abs(off) / 60;
          off = off / 60 * 100 + off % 60;
          return (ahead ? "+" : "-") + String("0000" + off).slice(-4);
        },
        "%Z": function (date) {
          return date.tm_zone;
        },
        "%%": function () {
          return "%";
        }
      };
      for (var rule in EXPANSION_RULES_2) {
        if (pattern.indexOf(rule) >= 0) {
          pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_2[rule](date));
        }
      }
      var bytes = intArrayFromString(pattern, false);
      if (bytes.length > maxsize) {
        return 0;
      }
      writeArrayToMemory(bytes, s);
      return bytes.length - 1;
    }
    function _strftime_l(s, maxsize, format, tm) {
      return _strftime(s, maxsize, format, tm);
    }
    var FSNode = function (parent, name, mode, rdev) {
      if (!parent) {
        parent = this;
      }
      this.parent = parent;
      this.mount = parent.mount;
      this.mounted = null;
      this.id = FS.nextInode++;
      this.name = name;
      this.mode = mode;
      this.node_ops = {};
      this.stream_ops = {};
      this.rdev = rdev;
    };
    var readMode = 292 | 73;
    var writeMode = 146;
    Object.defineProperties(FSNode.prototype, {
      read: {
        get: function () {
          return (this.mode & readMode) === readMode;
        },
        set: function (val) {
          val ? this.mode |= readMode : this.mode &= ~readMode;
        }
      },
      write: {
        get: function () {
          return (this.mode & writeMode) === writeMode;
        },
        set: function (val) {
          val ? this.mode |= writeMode : this.mode &= ~writeMode;
        }
      },
      isFolder: {
        get: function () {
          return FS.isDir(this.mode);
        }
      },
      isDevice: {
        get: function () {
          return FS.isChrdev(this.mode);
        }
      }
    });
    FS.FSNode = FSNode;
    FS.staticInit();
    embind_init_charCodes();
    BindingError = Module["BindingError"] = extendError(Error, "BindingError");
    InternalError = Module["InternalError"] = extendError(Error, "InternalError");
    init_ClassHandle();
    init_RegisteredPointer();
    init_embind();
    UnboundTypeError = Module["UnboundTypeError"] = extendError(Error, "UnboundTypeError");
    init_emval();
    function intArrayFromString(stringy, dontAddNull, length) {
      var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
      var u8array = new Array(len);
      var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
      if (dontAddNull) u8array.length = numBytesWritten;
      return u8array;
    }
    var asmLibraryArg = {
      "m": ___cxa_allocate_exception,
      "l": ___cxa_throw,
      "B": ___map_file,
      "p": ___sys_fcntl64,
      "M": ___sys_fstat64,
      "H": ___sys_ioctl,
      "J": ___sys_madvise1,
      "I": ___sys_mmap2,
      "K": ___sys_munmap,
      "q": ___sys_open,
      "L": ___sys_stat64,
      "O": __embind_register_bool,
      "t": __embind_register_class,
      "i": __embind_register_class_constructor,
      "a": __embind_register_class_function,
      "N": __embind_register_emval,
      "n": __embind_register_enum,
      "c": __embind_register_enum_value,
      "r": __embind_register_float,
      "d": __embind_register_function,
      "f": __embind_register_integer,
      "e": __embind_register_memory_view,
      "s": __embind_register_std_string,
      "k": __embind_register_std_wstring,
      "P": __embind_register_void,
      "h": _abort,
      "C": _clock_gettime,
      "w": _emscripten_memcpy_big,
      "x": _emscripten_resize_heap,
      "E": _environ_get,
      "F": _environ_sizes_get,
      "b": _exit,
      "j": _fd_close,
      "D": _fd_fdstat_get,
      "G": _fd_read,
      "u": _fd_seek,
      "o": _fd_write,
      "memory": wasmMemory,
      "g": _pthread_create,
      "y": _pthread_detach,
      "z": _pthread_join,
      "v": _setTempRet0,
      "A": _strftime_l,
      "table": wasmTable
    };
    var asm = createWasm();
    Module["asm"] = asm;
    var ___wasm_call_ctors = Module["___wasm_call_ctors"] = function () {
      return (___wasm_call_ctors = Module["___wasm_call_ctors"] = Module["asm"]["Q"]).apply(null, arguments);
    };
    var _memset = Module["_memset"] = function () {
      return (_memset = Module["_memset"] = Module["asm"]["R"]).apply(null, arguments);
    };
    var _malloc = Module["_malloc"] = function () {
      return (_malloc = Module["_malloc"] = Module["asm"]["S"]).apply(null, arguments);
    };
    var _free = Module["_free"] = function () {
      return (_free = Module["_free"] = Module["asm"]["T"]).apply(null, arguments);
    };
    var ___getTypeName = Module["___getTypeName"] = function () {
      return (___getTypeName = Module["___getTypeName"] = Module["asm"]["U"]).apply(null, arguments);
    };
    var ___embind_register_native_and_builtin_types = Module["___embind_register_native_and_builtin_types"] = function () {
      return (___embind_register_native_and_builtin_types = Module["___embind_register_native_and_builtin_types"] = Module["asm"]["V"]).apply(null, arguments);
    };
    var ___errno_location = Module["___errno_location"] = function () {
      return (___errno_location = Module["___errno_location"] = Module["asm"]["W"]).apply(null, arguments);
    };
    var _memalign = Module["_memalign"] = function () {
      return (_memalign = Module["_memalign"] = Module["asm"]["X"]).apply(null, arguments);
    };
    var dynCall_ii = Module["dynCall_ii"] = function () {
      return (dynCall_ii = Module["dynCall_ii"] = Module["asm"]["Y"]).apply(null, arguments);
    };
    var dynCall_vi = Module["dynCall_vi"] = function () {
      return (dynCall_vi = Module["dynCall_vi"] = Module["asm"]["Z"]).apply(null, arguments);
    };
    var dynCall_i = Module["dynCall_i"] = function () {
      return (dynCall_i = Module["dynCall_i"] = Module["asm"]["_"]).apply(null, arguments);
    };
    var dynCall_iii = Module["dynCall_iii"] = function () {
      return (dynCall_iii = Module["dynCall_iii"] = Module["asm"]["$"]).apply(null, arguments);
    };
    var dynCall_iiii = Module["dynCall_iiii"] = function () {
      return (dynCall_iiii = Module["dynCall_iiii"] = Module["asm"]["aa"]).apply(null, arguments);
    };
    var dynCall_iiiii = Module["dynCall_iiiii"] = function () {
      return (dynCall_iiiii = Module["dynCall_iiiii"] = Module["asm"]["ba"]).apply(null, arguments);
    };
    var dynCall_vii = Module["dynCall_vii"] = function () {
      return (dynCall_vii = Module["dynCall_vii"] = Module["asm"]["ca"]).apply(null, arguments);
    };
    var dynCall_viii = Module["dynCall_viii"] = function () {
      return (dynCall_viii = Module["dynCall_viii"] = Module["asm"]["da"]).apply(null, arguments);
    };
    var dynCall_viiii = Module["dynCall_viiii"] = function () {
      return (dynCall_viiii = Module["dynCall_viiii"] = Module["asm"]["ea"]).apply(null, arguments);
    };
    var dynCall_viiiii = Module["dynCall_viiiii"] = function () {
      return (dynCall_viiiii = Module["dynCall_viiiii"] = Module["asm"]["fa"]).apply(null, arguments);
    };
    var dynCall_iiiiii = Module["dynCall_iiiiii"] = function () {
      return (dynCall_iiiiii = Module["dynCall_iiiiii"] = Module["asm"]["ga"]).apply(null, arguments);
    };
    var dynCall_viijii = Module["dynCall_viijii"] = function () {
      return (dynCall_viijii = Module["dynCall_viijii"] = Module["asm"]["ha"]).apply(null, arguments);
    };
    var dynCall_jiji = Module["dynCall_jiji"] = function () {
      return (dynCall_jiji = Module["dynCall_jiji"] = Module["asm"]["ia"]).apply(null, arguments);
    };
    var dynCall_iidiiii = Module["dynCall_iidiiii"] = function () {
      return (dynCall_iidiiii = Module["dynCall_iidiiii"] = Module["asm"]["ja"]).apply(null, arguments);
    };
    var dynCall_iiiiiiiii = Module["dynCall_iiiiiiiii"] = function () {
      return (dynCall_iiiiiiiii = Module["dynCall_iiiiiiiii"] = Module["asm"]["ka"]).apply(null, arguments);
    };
    var dynCall_iiiiiii = Module["dynCall_iiiiiii"] = function () {
      return (dynCall_iiiiiii = Module["dynCall_iiiiiii"] = Module["asm"]["la"]).apply(null, arguments);
    };
    var dynCall_iiiiij = Module["dynCall_iiiiij"] = function () {
      return (dynCall_iiiiij = Module["dynCall_iiiiij"] = Module["asm"]["ma"]).apply(null, arguments);
    };
    var dynCall_iiiiid = Module["dynCall_iiiiid"] = function () {
      return (dynCall_iiiiid = Module["dynCall_iiiiid"] = Module["asm"]["na"]).apply(null, arguments);
    };
    var dynCall_iiiiijj = Module["dynCall_iiiiijj"] = function () {
      return (dynCall_iiiiijj = Module["dynCall_iiiiijj"] = Module["asm"]["oa"]).apply(null, arguments);
    };
    var dynCall_iiiiiiii = Module["dynCall_iiiiiiii"] = function () {
      return (dynCall_iiiiiiii = Module["dynCall_iiiiiiii"] = Module["asm"]["pa"]).apply(null, arguments);
    };
    var dynCall_iiiiiijj = Module["dynCall_iiiiiijj"] = function () {
      return (dynCall_iiiiiijj = Module["dynCall_iiiiiijj"] = Module["asm"]["qa"]).apply(null, arguments);
    };
    var dynCall_viiiiii = Module["dynCall_viiiiii"] = function () {
      return (dynCall_viiiiii = Module["dynCall_viiiiii"] = Module["asm"]["ra"]).apply(null, arguments);
    };
    var dynCall_v = Module["dynCall_v"] = function () {
      return (dynCall_v = Module["dynCall_v"] = Module["asm"]["sa"]).apply(null, arguments);
    };
    Module["asm"] = asm;
    var calledRun;
    function ExitStatus(status) {
      this.name = "ExitStatus";
      this.message = "Program terminated with exit(" + status + ")";
      this.status = status;
    }
    dependenciesFulfilled = function runCaller() {
      if (!calledRun) run();
      if (!calledRun) dependenciesFulfilled = runCaller;
    };
    function run(args) {
      args = args || arguments_;
      if (runDependencies > 0) {
        return;
      }
      preRun();
      if (runDependencies > 0) return;
      function doRun() {
        if (calledRun) return;
        calledRun = true;
        Module["calledRun"] = true;
        if (ABORT) return;
        initRuntime();
        preMain();
        readyPromiseResolve(Module);
        if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
        postRun();
      }
      if (Module["setStatus"]) {
        Module["setStatus"]("Running...");
        setTimeout(function () {
          setTimeout(function () {
            Module["setStatus"]("");
          }, 1);
          doRun();
        }, 1);
      } else {
        doRun();
      }
    }
    Module["run"] = run;
    function exit(status, implicit) {
      if (implicit && noExitRuntime && status === 0) {
        return;
      }
      if (noExitRuntime) {} else {
        ABORT = true;
        EXITSTATUS = status;
        exitRuntime();
        if (Module["onExit"]) Module["onExit"](status);
      }
      quit_(status, new ExitStatus(status));
    }
    if (Module["preInit"]) {
      if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
      while (Module["preInit"].length > 0) {
        Module["preInit"].pop()();
      }
    }
    noExitRuntime = true;
    run();
    return Module.ready;
  };
}();
var _default = exports.default = Module;

}).call(this)}).call(this,require('_process'))
},{"_process":23}],23:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],24:[function(require,module,exports){
"use strict";

var _ffishEs = _interopRequireDefault(require("ffish-es6"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// NoaChess - Simple chess UI using Fairy-Stockfish and Chessground
const Chessground = require('chessgroundx').Chessground;
let ffish;
let board;
let game;
let chessground;

// Current selected variant
let currentVariant = 'noachess';

// Variant configurations
const VARIANT_CONFIG = {
  chess: {
    name: 'chess',
    displayName: 'Original Chess',
    subtitle: 'Classic 8×8 chess',
    iniFile: 'chess.ini',
    startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    boardSize: {
      width: 8,
      height: 8
    }
  },
  noachess: {
    name: 'noachess',
    displayName: 'NoaChess',
    subtitle: 'A unique 6×6 chess variant',
    iniFile: 'noachess.ini',
    startFen: 'lbqknr/pppppp/6/6/PPPPPP/LBQKNR w - - 0 1',
    boardSize: {
      width: 6,
      height: 6
    }
  },
  orda: {
    name: 'orda',
    displayName: 'Orda Chess',
    subtitle: 'Asymmetric 8×8 variant (Kingdom vs Horde)',
    iniFile: 'orda.ini',
    startFen: 'lhaykahl/8/pppppppp/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1',
    boardSize: {
      width: 8,
      height: 8
    }
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
    locateFile: function (path) {
      // Ensure worker files are located in the correct path
      console.log('Locating file:', path);
      return '/' + path;
    }
  }).then(sf => {
    stockfishEngine = sf;
    console.log('Fairy-Stockfish engine initialized');

    // Setup message listener
    stockfishEngine.addMessageListener(line => {
      console.log('SF:', line);
      if (line.startsWith('Fairy-Stockfish')) {
        // Load variant configuration
        window.prompt = function () {
          return variantsIni + '\nEOF';
        };
        stockfishEngine.postMessage('load <<EOF');
        stockfishEngine.postMessage('uci');
      } else if (line.includes('uciok')) {
        const config = VARIANT_CONFIG[currentVariant];
        if (config) {
          stockfishEngine.postMessage('setoption name UCI_Variant value ' + config.name);
        }
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

// Load a specific variant
function loadVariant(variantKey) {
  const config = VARIANT_CONFIG[variantKey];
  if (!config) {
    console.error('Unknown variant:', variantKey);
    return;
  }
  console.log(`Loading variant: ${config.displayName}`);
  fetch('./' + config.iniFile).then(response => response.text()).then(ini => {
    variantsIni = ini;
    console.log(`${config.displayName} INI content:`, ini);
    ffish.loadVariantConfig(ini);
    console.log(`${config.displayName} variant loaded!`);
    console.log('Available variants:', ffish.variants());

    // Update UI
    document.getElementById('gameTitle').textContent = config.displayName;
    document.getElementById('gameSubtitle').textContent = config.subtitle;

    // Initialize game
    currentVariant = variantKey;
    initGame();

    // Re-initialize Stockfish with new variant
    if (stockfishReady && stockfishEngine) {
      // Load new variant configuration into Stockfish
      window.prompt = function () {
        return variantsIni + '\nEOF';
      };
      stockfishEngine.postMessage('load <<EOF');

      // Wait a bit for variant to load, then set it
      setTimeout(() => {
        stockfishEngine.postMessage('setoption name UCI_Variant value ' + config.name);
        stockfishEngine.postMessage('ucinewgame');
        stockfishEngine.postMessage('isready');
      }, 100);
    }
  }).catch(error => {
    console.error(`Failed to load ${config.displayName} variant:`, error);
    updateStatus('Error loading game. Please refresh.');
  });
}

// Initialize Fairy-Stockfish
new _ffishEs.default().then(loadedModule => {
  ffish = loadedModule;
  console.log('ffish-es6 loaded!');

  // Load initial variant (NoaChess by default)
  loadVariant(currentVariant);

  // Initialize Stockfish engine
  initStockfishEngine();
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

  // Get current variant config
  const config = VARIANT_CONFIG[currentVariant];
  if (!config) {
    console.error('Invalid variant config:', currentVariant);
    return;
  }

  // Create new game with variant config
  game = new ffish.Board(config.name, config.startFen);
  console.log('Game initialized with variant:', game.variant());
  console.log('Legal moves from start:', game.legalMoves());

  // Initialize position history and record initial position
  positionHistory = [];
  gameSaved = false; // Reset game saved flag
  recordPosition();

  // Initialize or update chessground
  const boardElement = document.getElementById('board');

  // Update board size class
  boardElement.className = '';
  boardElement.classList.add(`board-${config.boardSize.width}x${config.boardSize.height}`);

  // Update captured pieces container height to match board
  const capturedContainer = document.querySelector('.captured-container');
  if (capturedContainer) {
    const boardSize = config.boardSize.width === 8 ? 640 : 600;
    capturedContainer.style.height = `${boardSize}px`;
  }
  const boardConfig = {
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
    dimensions: config.boardSize
  };

  // Always destroy and recreate chessground to ensure proper rendering
  // especially when switching between different board sizes
  const needsEventListeners = !chessground;
  if (chessground) {
    chessground.destroy();
  }
  chessground = Chessground(boardElement, boardConfig);

  // Add event listeners for checkboxes (only once)
  if (needsEventListeners) {
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
  return isWhiteTurn && !playWhite || !isWhiteTurn && !playBlack;
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
    const searchListener = line => {
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
    'p': 100,
    'n': 320,
    'b': 330,
    'r': 280,
    'q': 450,
    'l': 240,
    'g': 150,
    'k': 0
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
      movable: {
        dests: new Map()
      }
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
window.startAutoPlay = function () {
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
};
window.stopAutoPlay = function () {
  autoPlayMode = false;
  updateAutoPlayUI();
  updateStatus(`Auto-play stopped. ${autoPlayCount} games completed.`);
};
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
window.downloadGames = function () {
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
  const blob = new Blob([json], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `noachess-games-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  updateStatus(`Downloaded ${autoPlayGames.length} games!`);
};
function calculateOpeningStats() {
  const openingCounts = {};
  const openingWins = {};
  autoPlayGames.forEach(game => {
    const opening = game.opening;
    if (!openingCounts[opening]) {
      openingCounts[opening] = 0;
      openingWins[opening] = {
        white: 0,
        black: 0,
        draw: 0
      };
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
    <p><strong>White wins:</strong> ${whiteWins} (${(whiteWins / autoPlayGames.length * 100).toFixed(1)}%)</p>
    <p><strong>Black wins:</strong> ${blackWins} (${(blackWins / autoPlayGames.length * 100).toFixed(1)}%)</p>
    <p><strong>Draws:</strong> ${draws} (${(draws / autoPlayGames.length * 100).toFixed(1)}%)</p>
  `;
}
function requestEvaluation() {
  if (!stockfishReady || !stockfishEngine) return;
  const evalDepth = 10;
  let lastEvaluation = 0;

  // Quick evaluation at depth 10 for responsiveness
  const evalListener = line => {
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
  const blackPercent = blackWins / total * 100;
  const drawPercent = draws / total * 100;
  const whitePercent = whiteWins / total * 100;

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
window.newGame = function () {
  if (game) game.delete();
  currentGameMoves = []; // Reset move record
  currentEvaluation = 0; // Reset evaluation
  positionHistory = []; // Reset position history
  resetCapturedPieces(); // Reset captured pieces

  // Destroy chessground to force fresh rendering
  if (chessground) {
    chessground.destroy();
    chessground = null;
  }
  initGame();
};
window.flipBoard = function () {
  chessground.toggleOrientation();
  boardOrientation = boardOrientation === 'white' ? 'black' : 'white';
  updateCapturedPiecesDisplay();
};

// Get pieces from FEN string
function getPiecesFromFen(fen) {
  const pieces = {};
  const pieceTypes = ['p', 'n', 'b', 'r', 'q', 'l', 'g', 'k', 'P', 'N', 'B', 'R', 'Q', 'L', 'G', 'K'];
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
  const allPieces = ['p', 'n', 'b', 'r', 'q', 'l', 'g', 'P', 'N', 'B', 'R', 'Q', 'L', 'G'];
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
  const pieceOrder = {
    'q': 0,
    'r': 1,
    'b': 2,
    'l': 3,
    'n': 4,
    'g': 5,
    'p': 6
  };
  const sortPieces = arr => [...arr].sort((a, b) => pieceOrder[a] - pieceOrder[b]);
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
    'l': color === 'white' ? '⚔' : '⚔',
    // Leaper uses dagger symbol
    'g': color === 'white' ? '★' : '★' // General uses star symbol
  };
  return symbols[piece] || piece;
}

// Reset captured pieces
function resetCapturedPieces() {
  capturedByWhite = [];
  capturedByBlack = [];
  updateCapturedPiecesDisplay();
}
window.undoMove = function () {
  if (game && !game.isGameOver()) {
    // Undo 2 moves if playing against AI
    const playWhite = document.getElementById('playWhite').checked;
    const playBlack = document.getElementById('playBlack').checked;
    const count = playWhite && playBlack ? 1 : 2;
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
};

// Select and load a chess variant
window.selectVariant = function (variantKey) {
  if (!VARIANT_CONFIG[variantKey]) {
    console.error('Unknown variant:', variantKey);
    return;
  }

  // Update select dropdown
  const select = document.getElementById('variantSelect');
  if (select) {
    select.value = variantKey;
  }

  // Clean up current game
  if (game) {
    game.delete();
  }
  currentGameMoves = [];
  currentEvaluation = 0;
  positionHistory = [];
  resetCapturedPieces();

  // Stop any autoplay
  if (autoPlayMode) {
    autoPlayMode = false;
    updateAutoPlayUI();
  }

  // Destroy existing chessground to force recreation
  if (chessground) {
    chessground.destroy();
    chessground = null;
  }

  // Load new variant
  loadVariant(variantKey);
};

},{"chessgroundx":5,"ffish-es6":22}]},{},[24]);
