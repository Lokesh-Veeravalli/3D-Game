import { Chess, type Move, type Square } from "chess.js";

/** Standard material values (centipawns-ish). */
const PIECE_VALUE: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

export type AiOptions = {
  depth: number;
};

/** Small center / development nudge so equal material positions aren't random edge-pawn moves. */
const CENTER_BONUS: Record<string, number> = {
  d4: 12,
  e4: 12,
  d5: 12,
  e5: 12,
  c3: 6,
  c4: 8,
  c5: 8,
  c6: 6,
  d3: 6,
  e3: 6,
  f3: 6,
  f4: 8,
  f5: 8,
  f6: 6,
  d6: 6,
  e6: 6,
};

/**
 * Material (+ light positional) evaluation from White's perspective.
 * Positive = White better.
 */
export function evaluateMaterial(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === "w" ? -100000 : 100000;
  }
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) {
    return 0;
  }

  let score = 0;
  const board = chess.board();
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const square = board[rank]![file];
      if (!square) continue;
      const value = PIECE_VALUE[square.type] ?? 0;
      const sqName = `${"abcdefgh"[file]}${8 - rank}`;
      const center = CENTER_BONUS[sqName] ?? 0;
      const positional =
        square.type === "p" || square.type === "n" || square.type === "b"
          ? center
          : center / 2;
      const total = value + positional;
      score += square.color === "w" ? total : -total;
    }
  }

  // Slight mobility so developing moves beat waiting moves at equal material
  const mobility = chess.moves().length;
  score += chess.turn() === "w" ? mobility * 2 : -mobility * 2;

  return score;
}

function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => {
    const aCap = a.captured ? PIECE_VALUE[a.captured] : 0;
    const bCap = b.captured ? PIECE_VALUE[b.captured] : 0;
    return bCap - aCap;
  });
}

function minimax(
  chess: Chess,
  depth: number,
  maximizing: boolean,
  alpha: number,
  beta: number,
): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluateMaterial(chess);
  }

  const moves = orderMoves(chess.moves({ verbose: true }));

  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const score = minimax(chess, depth - 1, false, alpha, beta);
      chess.undo();
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    chess.move(move);
    const score = minimax(chess, depth - 1, true, alpha, beta);
    chess.undo();
    best = Math.min(best, score);
    beta = Math.min(beta, score);
    if (beta <= alpha) break;
  }
  return best;
}

/** Choose the best move for the side to move. */
export function findBestMove(fen: string, options: AiOptions): Move | null {
  const chess = new Chess(fen);
  const moves = orderMoves(chess.moves({ verbose: true }));
  if (moves.length === 0) return null;

  const maximizing = chess.turn() === "w";
  let bestScore = maximizing ? -Infinity : Infinity;
  const candidates: Move[] = [];

  for (const move of moves) {
    chess.move(move);
    const score = minimax(
      chess,
      options.depth - 1,
      !maximizing,
      -Infinity,
      Infinity,
    );
    chess.undo();

    if (score === bestScore) {
      candidates.push(move);
    } else if (maximizing ? score > bestScore : score < bestScore) {
      bestScore = score;
      candidates.length = 0;
      candidates.push(move);
    }
  }

  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

export type SimpleMove = { from: Square; to: Square; promotion?: string };
