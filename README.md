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

## Deploy to Cloudflare

This app deploys to [Cloudflare Workers](https://developers.cloudflare.com/workers/) via [@opennextjs/cloudflare](https://opennext.js.org/cloudflare). The 3D cube and training UI run entirely in the browser (localStorage + WebGL), so no database or server API is required.

### Prerequisites

- [Node.js](https://nodejs.org/) 20+ (Node 22+ recommended for Wrangler)
- A [Cloudflare account](https://dash.cloudflare.com/sign-up)
- Wrangler CLI auth: `npx wrangler login`

### Build and deploy

```bash
npm install
npm run cf:build    # build for Cloudflare (Next.js + OpenNext transform)
npm run preview     # build and preview locally in the Workers runtime
npm run deploy      # build and deploy to Cloudflare Workers
```

The worker name is `speffz-lettering` (see `wrangler.jsonc`). After deploy, Wrangler prints the `*.workers.dev` URL.

### Environment variables

No secrets are required for the trainer itself. Optional local dev vars live in `.dev.vars`:

| Variable | Purpose |
|----------|---------|
| `NEXTJS_ENV` | Which Next.js `.env*` files to load (`development` locally, defaults to `production` on deploy) |

### Cloudflare CI (optional)

Connect the repo in the Cloudflare dashboard and set the build command to `npm run cf:build` and the deploy command to `npm run deploy` (or use Workers Builds with the same commands).

## Tech stack

- Next.js (App Router), TypeScript, React, Tailwind CSS
- Three.js via `@react-three/fiber` and `@react-three/drei`
