"use client";

import { useEffect, useRef, useState } from "react";
import { ALL_FACES, FACE_COLORS, getFaceLetterGrid, getStickersForFace } from "@/lib/stickers";
import type { Face, StickerPosition } from "@/types/cube";

const POSITIONS: StickerPosition[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

interface FaceDrillProps {
  face: Face;
  practiceAllFaces: boolean;
  onSubmit: (results: { position: StickerPosition; correct: boolean }[]) => void;
  feedback: Record<StickerPosition, "idle" | "correct" | "incorrect"> | null;
  disabled?: boolean;
  onFaceChange?: (face: Face) => void;
}

export default function FaceDrill({
  face,
  practiceAllFaces,
  onSubmit,
  feedback,
  disabled,
  onFaceChange,
}: FaceDrillProps) {
  const [inputs, setInputs] = useState<Record<StickerPosition, string>>({
    "top-left": "",
    "top-right": "",
    "bottom-left": "",
    "bottom-right": "",
  });
  const inputRefs = useRef<Partial<Record<StickerPosition, HTMLInputElement>>>({});

  const stickers = getStickersForFace(face);
  const answerMap = Object.fromEntries(
    stickers.map((s) => [s.position, s.letter]),
  ) as Record<StickerPosition, string>;

  useEffect(() => {
    setInputs({
      "top-left": "",
      "top-right": "",
      "bottom-left": "",
      "bottom-right": "",
    });
    inputRefs.current["top-left"]?.focus();
  }, [face]);

  const handleChange = (position: StickerPosition, value: string) => {
    const letter = value.slice(-1).toUpperCase();
    setInputs((prev) => ({ ...prev, [position]: letter }));
    if (letter) {
      const idx = POSITIONS.indexOf(position);
      const next = POSITIONS[idx + 1];
      if (next) inputRefs.current[next]?.focus();
    }
  };

  const handleSubmit = () => {
    const results = POSITIONS.map((position) => ({
      position,
      correct: inputs[position].toUpperCase() === answerMap[position],
    }));
    onSubmit(results);
  };

  const cellClass = (position: StickerPosition) => {
    const state = feedback?.[position] ?? "idle";
    const base =
      "min-h-11 min-w-11 h-14 w-14 rounded-xl border-2 text-center text-2xl font-bold uppercase outline-none transition-all sm:h-16 sm:w-16 md:h-20 md:w-20";
    if (state === "correct") return `${base} border-emerald-400 bg-emerald-500/20 text-emerald-100`;
    if (state === "incorrect") return `${base} border-rose-400 bg-rose-500/20 text-rose-100`;
    return `${base} border-slate-600 bg-slate-800 text-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-400">Face</label>
        <select
          value={face}
          disabled={practiceAllFaces || disabled}
          onChange={(e) => onFaceChange?.(e.target.value as Face)}
          className="min-h-11 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
        >
          {ALL_FACES.map((f) => (
            <option key={f} value={f}>
              {f} — {f === "U" ? "Up" : f === "D" ? "Down" : f === "F" ? "Front" : f === "B" ? "Back" : f === "R" ? "Right" : "Left"}
            </option>
          ))}
        </select>
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-600 text-sm font-bold"
          style={{ backgroundColor: FACE_COLORS[face] }}
        >
          {face}
        </span>
      </div>

      <p className="text-sm text-slate-400">
        Enter the four letters clockwise from top-left. Example for U: A B / D C
      </p>

      <div className="mx-auto w-fit rounded-2xl border border-slate-700 bg-slate-900/50 p-4">
        <div className="grid grid-cols-2 gap-3">
          <input
            ref={(el) => { inputRefs.current["top-left"] = el ?? undefined; }}
            value={inputs["top-left"]}
            disabled={disabled}
            maxLength={1}
            onChange={(e) => handleChange("top-left", e.target.value)}
            className={cellClass("top-left")}
            aria-label="Top left"
          />
          <input
            ref={(el) => { inputRefs.current["top-right"] = el ?? undefined; }}
            value={inputs["top-right"]}
            disabled={disabled}
            maxLength={1}
            onChange={(e) => handleChange("top-right", e.target.value)}
            className={cellClass("top-right")}
            aria-label="Top right"
          />
          <input
            ref={(el) => { inputRefs.current["bottom-left"] = el ?? undefined; }}
            value={inputs["bottom-left"]}
            disabled={disabled}
            maxLength={1}
            onChange={(e) => handleChange("bottom-left", e.target.value)}
            className={cellClass("bottom-left")}
            aria-label="Bottom left"
          />
          <input
            ref={(el) => { inputRefs.current["bottom-right"] = el ?? undefined; }}
            value={inputs["bottom-right"]}
            disabled={disabled}
            maxLength={1}
            onChange={(e) => handleChange("bottom-right", e.target.value)}
            className={cellClass("bottom-right")}
            aria-label="Bottom right"
          />
        </div>
      </div>

      <button
        type="button"
        disabled={disabled || POSITIONS.some((p) => !inputs[p])}
        onClick={handleSubmit}
        className="min-h-11 w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Check Face
      </button>

      {feedback && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm">
          <div className="mb-2 font-medium text-slate-300">Answer key</div>
          <pre className="font-mono text-lg text-white">{formatGrid(getFaceLetterGrid(face))}</pre>
        </div>
      )}
    </div>
  );
}

function formatGrid(grid: string[][]): string {
  return `${grid[0][0]} ${grid[0][1]}\n${grid[1][0]} ${grid[1][1]}`;
}
