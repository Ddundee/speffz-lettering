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
- Stats: streak, accuracy, weak letters (recency-weighted), weak faces, response times
- Session vs all-time stats scope; “needs practice” badges; practice weak letters action
- Settings panel: **Learning mode** (letters visible) vs **Test mode** (letters hidden)
- Keyboard shortcuts with collapsible legend (press `?`)
- Responsive layout: cube stacks above panel on mobile, 44px tap targets

## Settings

Open **Settings** (gear icon) to choose the default letter display mode:

| Mode | Behavior |
|------|----------|
| **Learning** | Letters shown on cube stickers — helpful while memorizing |
| **Test** | Letters hidden on stickers — default for real training (stored in `blind-cube-letter-trainer-settings`) |

The header **Show Letters (L)** toggle temporarily overrides the setting for the current browser session. Face drill answer keys still appear after you submit — settings only affect cube sticker labels during prompts.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `1` / `F1` | Find the Letter mode |
| `2` / `F2` | Name the Sticker mode |
| `3` / `F3` | Face Drill mode |
| `Enter` | Submit letter (name mode) |
| `R` | Reset cube view |
| `N` | New round |
| `L` | Toggle show/hide letters (session override) |
| `T` | Toggle 60s timed mode |
| `Esc` | Dismiss timed summary / clear focus |
| `?` | Toggle shortcut legend |

Press `?` or use the footer hint to show the full legend in the app.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other commands

```bash
npm run next:build   # standard Next.js production build (local / Vercel-style)
npm run start        # serve production build
npm run lint         # ESLint
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
npm run build       # build for Cloudflare (Next.js + OpenNext → .open-next/)
npm run preview     # build and preview locally in the Workers runtime
npm run build && npm run deploy   # build and deploy to Cloudflare Workers
```

The worker name is `speffz-lettering` (see `wrangler.jsonc`). After deploy, Wrangler prints the `*.workers.dev` URL.

`npm run build` runs `opennextjs-cloudflare build`, which produces `.open-next/worker.js` and related assets required by Wrangler. Use `npm run next:build` only when you need a plain Next.js build without the OpenNext transform.

Builds are capped at a 4GB Node heap (`NODE_OPTIONS='--max-old-space-size=4096'`) for low-RAM machines (e.g. 8GB Mac). Run one build at a time — do not run `npm run build` alongside `npm run dev` or other heavy processes.

### Environment variables

No secrets are required for the trainer itself. Optional local dev vars live in `.dev.vars`:

| Variable | Purpose |
|----------|---------|
| `NEXTJS_ENV` | Which Next.js `.env*` files to load (`development` locally, defaults to `production` on deploy) |

### Cloudflare CI (Git-connected Workers)

When connecting this repo in the Cloudflare dashboard, use the default Workers Builds split:

| Step | Command |
|------|---------|
| **Build command** | `npm run build` |
| **Deploy command** | `npx wrangler deploy` |

Cloudflare CI runs the build step first, then deploy. The build must produce `.open-next/` artifacts; `npm run build` handles that via OpenNext. Do **not** set the build command to `next build` alone — Wrangler will fail with “Could not find compiled Open Next config”.

For a one-shot local deploy after building: `npm run deploy` (runs `opennextjs-cloudflare deploy` against the existing `.open-next/` output).

## Tech stack

- Next.js (App Router), TypeScript, React, Tailwind CSS
- Three.js via `@react-three/fiber` and `@react-three/drei`
