import type { Face, PieceType, Sticker, StickerPosition } from "@/types/cube";

const FACE_LETTERS: Record<Face, [string, string, string, string]> = {
  U: ["A", "B", "C", "D"],
  L: ["E", "F", "G", "H"],
  F: ["I", "J", "K", "L"],
  R: ["M", "N", "O", "P"],
  B: ["Q", "R", "S", "T"],
  D: ["U", "V", "W", "X"],
};

const POSITION_ORDER: StickerPosition[] = [
  "top-left",
  "top-right",
  "bottom-right",
  "bottom-left",
];

const POSITION_TYPE: Record<StickerPosition, PieceType> = {
  "top-left": "corner",
  "top-right": "edge",
  "bottom-right": "corner",
  "bottom-left": "edge",
};

/** Cubie coordinates for each face position (Speffz 2x2 layout, center excluded). */
const FACE_COORDINATES: Record<
  Face,
  Record<StickerPosition, { x: -1 | 0 | 1; y: -1 | 0 | 1; z: -1 | 0 | 1 }>
> = {
  U: {
    "top-left": { x: -1, y: 1, z: 1 },
    "top-right": { x: 1, y: 1, z: 1 },
    "bottom-right": { x: 1, y: 1, z: -1 },
    "bottom-left": { x: -1, y: 1, z: -1 },
  },
  D: {
    "top-left": { x: -1, y: -1, z: 1 },
    "top-right": { x: 1, y: -1, z: 1 },
    "bottom-right": { x: 1, y: -1, z: -1 },
    "bottom-left": { x: -1, y: -1, z: -1 },
  },
  F: {
    "top-left": { x: -1, y: 1, z: 1 },
    "top-right": { x: 1, y: 1, z: 1 },
    "bottom-right": { x: 1, y: -1, z: 1 },
    "bottom-left": { x: -1, y: -1, z: 1 },
  },
  B: {
    "top-left": { x: 1, y: 1, z: -1 },
    "top-right": { x: -1, y: 1, z: -1 },
    "bottom-right": { x: -1, y: -1, z: -1 },
    "bottom-left": { x: 1, y: -1, z: -1 },
  },
  R: {
    "top-left": { x: 1, y: 1, z: -1 },
    "top-right": { x: 1, y: 1, z: 1 },
    "bottom-right": { x: 1, y: -1, z: 1 },
    "bottom-left": { x: 1, y: -1, z: -1 },
  },
  L: {
    "top-left": { x: -1, y: 1, z: 1 },
    "top-right": { x: -1, y: 1, z: -1 },
    "bottom-right": { x: -1, y: -1, z: -1 },
    "bottom-left": { x: -1, y: -1, z: 1 },
  },
};

export const FACE_COLORS: Record<Face, string> = {
  U: "#ffffff",
  D: "#ffd500",
  F: "#009b48",
  B: "#0046ad",
  R: "#b71234",
  L: "#ff5800",
};

export const ALL_FACES: Face[] = ["U", "L", "F", "R", "B", "D"];

function buildStickers(): Sticker[] {
  const stickers: Sticker[] = [];

  for (const face of ALL_FACES) {
    const letters = FACE_LETTERS[face];
    POSITION_ORDER.forEach((position, index) => {
      const letter = letters[index];
      stickers.push({
        id: `${face}-${position}`,
        letter,
        face,
        type: POSITION_TYPE[position],
        position,
        coordinates: FACE_COORDINATES[face][position],
      });
    });
  }

  return stickers;
}

export const STICKERS: Sticker[] = buildStickers();

export const STICKER_BY_ID: Record<string, Sticker> = Object.fromEntries(
  STICKERS.map((s) => [s.id, s]),
);

export const STICKER_BY_LETTER: Record<string, Sticker> = Object.fromEntries(
  STICKERS.map((s) => [s.letter, s]),
);

export const STICKER_BY_LOCATION: Record<string, Sticker> = Object.fromEntries(
  STICKERS.map((s) => [
    `${s.face}:${s.coordinates.x},${s.coordinates.y},${s.coordinates.z}`,
    s,
  ]),
);

export function getStickerAtCubieFace(
  face: Face,
  x: -1 | 0 | 1,
  y: -1 | 0 | 1,
  z: -1 | 0 | 1,
): Sticker | undefined {
  return STICKER_BY_LOCATION[`${face}:${x},${y},${z}`];
}

export function getStickersForFace(face: Face): Sticker[] {
  return STICKERS.filter((s) => s.face === face);
}

export function getFaceLetterGrid(face: Face): string[][] {
  const stickers = getStickersForFace(face);
  const byPosition = Object.fromEntries(
    stickers.map((s) => [s.position, s.letter]),
  ) as Record<StickerPosition, string>;

  return [
    [byPosition["top-left"], byPosition["top-right"]],
    [byPosition["bottom-left"], byPosition["bottom-right"]],
  ];
}

export function filterStickers(
  filter: "all" | "edges" | "corners",
): Sticker[] {
  if (filter === "all") return STICKERS;
  if (filter === "edges") return STICKERS.filter((s) => s.type === "edge");
  return STICKERS.filter((s) => s.type === "corner");
}

export function pickRandomSticker(
  pool: Sticker[],
  excludeId?: string,
): Sticker {
  const candidates = excludeId
    ? pool.filter((s) => s.id !== excludeId)
    : pool;
  if (candidates.length === 0) return pool[Math.floor(Math.random() * pool.length)];
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function pickRandomFace(exclude?: Face): Face {
  const faces = exclude ? ALL_FACES.filter((f) => f !== exclude) : ALL_FACES;
  return faces[Math.floor(Math.random() * faces.length)];
}
