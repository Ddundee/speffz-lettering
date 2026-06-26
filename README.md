# Blind Cube Letter Trainer

An interactive web app for memorizing **Speffz-style sticker lettering** on a 3×3 Rubik's cube — built for blindfolded solving and Old Pochmann edge/corner tracing.

## What it does

The app renders a clickable 3D cube and runs short drills so you learn which letter belongs on each sticker. Progress (accuracy, streaks, weak letters, response times) is saved in **localStorage**.

## Training modes

### 1. Find the Letter

A random letter is shown (e.g. “Find K”). Click the matching sticker on the 3D cube. Correct clicks flash green; wrong clicks flash red and briefly highlight the correct sticker.

### 2. Name the Sticker

A sticker is highlighted on the cube. Type its letter and press Enter. Tracks typing accuracy and average response time.

### 3. Face Drill

Pick a face (U, L, F, R, B, D) or practice all faces in random order. Fill in four input boxes arranged like the face layout and submit to check all four letters.

## Letter scheme (Speffz)

On each face, letters go **clockwise** around the four non-center stickers: top-left → top-right → bottom-right → bottom-left.

Visual layout (example U face):

```
A B
D C
```

| Face | Top-left | Top-right | Bottom-right | Bottom-left |
|------|----------|-----------|--------------|-------------|
| U    | A        | B         | C            | D           |
| L    | E        | F         | G            | H           |
| F    | I        | J         | K            | L           |
| R    | M        | N         | O            | P           |
| B    | Q        | R         | S            | T           |
| D    | U        | V         | W            | X           |

Centers are unlabeled and not part of drills. Letter mappings live in `src/lib/stickers.ts` for easy customization.

## Features

- Interactive 3D cube (orbit controls, reset view, optional letter overlay)
- Filters: all stickers, edges only, corners only
- 60-second timed mode with end-of-round summary
- Stats: streak, accuracy, weak letters, response times
- Responsive dashboard layout (desktop & tablet)

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other commands

```bash
npm run build   # production build
npm run start   # serve production build
npm run lint    # ESLint
```

## Tech stack

- Next.js (App Router), TypeScript, React, Tailwind CSS
- Three.js via `@react-three/fiber` and `@react-three/drei`
