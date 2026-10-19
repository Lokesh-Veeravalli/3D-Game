import "./styles.css";
import { Chess, type Square } from "chess.js";
import { findBestMove } from "./ai";
import { ChessScene } from "./board";

const DEFAULT_AI_DEPTH = 3;

const canvas = document.querySelector<HTMLCanvasElement>("#board")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const newGameBtn = document.querySelector<HTMLButtonElement>("#new-game")!;
const depthSelect = document.querySelector<HTMLSelectElement>("#ai-depth")!;

const scene = new ChessScene(canvas);
const game = new Chess();

let selected: Square | null = null;
let aiThinking = false;
let aiDepth = Number(depthSelect.value) || DEFAULT_AI_DEPTH;
let pointerDown: { x: number; y: number } | null = null;

function boardPieces() {
  const pieces: Array<{
    square: Square;
    type: import("chess.js").PieceSymbol;
    color: import("chess.js").Color;
  }> = [];
  const board = game.board();
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const p = board[rank]![file];
      if (!p) continue;
      const square = `${"abcdefgh"[file]}${8 - rank}` as Square;
      pieces.push({ square, type: p.type, color: p.color });
    }
  }
  return pieces;
}

function occupiedSquares(): Set<Square> {
  return new Set(boardPieces().map((p) => p.square));
}

function updateStatus(): void {
  statusEl.classList.remove("is-check", "is-over");

  if (game.isCheckmate()) {
    const winner = game.turn() === "w" ? "Black" : "White";
    statusEl.textContent = `Checkmate — ${winner} wins`;
    statusEl.classList.add("is-over");
    return;
  }
  if (game.isStalemate()) {
    statusEl.textContent = "Stalemate — draw";
    statusEl.classList.add("is-over");
    return;
  }
  if (game.isDraw()) {
    statusEl.textContent = "Draw";
    statusEl.classList.add("is-over");
    return;
  }

  const side = game.turn() === "w" ? "White" : "Black";
  if (aiThinking) {
    statusEl.textContent = "Black is thinking…";
    return;
  }
  if (game.isCheck()) {
    statusEl.textContent = `${side} in check`;
    statusEl.classList.add("is-check");
    return;
  }
  statusEl.textContent = `${side} to move`;
}

function refreshBoard(): void {
  scene.setBoard(boardPieces());
  scene.clearSelection();
  selected = null;
  updateStatus();
}

function selectSquare(square: Square): void {
  if (aiThinking || game.isGameOver() || game.turn() !== "w") return;

  const piece = game.get(square);
  if (piece && piece.color === "w") {
    selected = square;
    const legal = game
      .moves({ square, verbose: true })
      .map((m) => m.to as Square);
    scene.setSelection(square, legal, occupiedSquares());
    return;
  }

  if (selected) {
    tryMove(selected, square);
  }
}

function tryMove(from: Square, to: Square): boolean {
  const moves = game.moves({ square: from, verbose: true }).filter((m) => m.to === to);
  if (moves.length === 0) {
    selected = null;
    scene.clearSelection();
    return false;
  }

  // Auto-queen promotions for MVP
  const move = moves.find((m) => m.promotion === "q") ?? moves[0]!;
  game.move({
    from: move.from,
    to: move.to,
    promotion: move.promotion,
  });

  selected = null;
  refreshBoard();

  if (!game.isGameOver() && game.turn() === "b") {
    scheduleAiMove();
  }
  return true;
}

function scheduleAiMove(): void {
  aiThinking = true;
  updateStatus();
  // Yield so the UI can paint "thinking" before a sync search
  window.setTimeout(() => {
    runAiMove();
  }, 40);
}

function runAiMove(): void {
  const best = findBestMove(game.fen(), { depth: aiDepth });
  if (best) {
    game.move({
      from: best.from,
      to: best.to,
      promotion: best.promotion,
    });
  }
  aiThinking = false;
  refreshBoard();
}

function resetGame(): void {
  game.reset();
  aiThinking = false;
  selected = null;
  refreshBoard();
}

newGameBtn.addEventListener("click", () => resetGame());
depthSelect.addEventListener("change", () => {
  aiDepth = Number(depthSelect.value) || DEFAULT_AI_DEPTH;
});

canvas.addEventListener("pointerdown", (e) => {
  pointerDown = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener("pointerup", (e) => {
  if (!pointerDown) return;
  const dx = e.clientX - pointerDown.x;
  const dy = e.clientY - pointerDown.y;
  pointerDown = null;
  // Ignore drags used for orbit
  if (Math.hypot(dx, dy) > 6) return;
  const square = scene.pickSquare(e.clientX, e.clientY);
  if (square) selectSquare(square);
});

function animate(): void {
  requestAnimationFrame(animate);
  scene.render();
}

refreshBoard();
animate();
