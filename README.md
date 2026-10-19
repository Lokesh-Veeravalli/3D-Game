# 3D Chess

Playable browser 3D chess: you play White against a computer opponent (Black).

## Stack

- Vite + TypeScript + Three.js
- `chess.js` for rules
- Minimax + material evaluation for the AI (depth 2–3, tunable in the UI)

## Run

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

## Play

1. Click a White piece to select it (legal squares highlight).
2. Click a highlighted square to move.
3. The computer replies as Black.
4. Use **New game** to reset. Adjust **AI depth** for speed vs strength.

## Build

```bash
npm run build
npm run preview
```
