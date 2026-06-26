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

const FACE_NAMES: Record<Face, string> = {
  U: "Up",
  D: "Down",
  F: "Front",
  B: "Back",
  R: "Right",
  L: "Left",
};

/** Faces that take dark chip text for WCAG-AA contrast (white text fails on
 *  these: white #ffffff, yellow #ffd500, and orange #f97316). */
const LIGHT_FACES: Face[] = ["U", "D", "L"];

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
      "min-h-11 min-w-11 h-14 w-14 rounded-2xl border-2 text-center text-2xl font-bold uppercase outline-none transition-all duration-200 sm:h-16 sm:w-16 md:h-[4.5rem] md:w-[4.5rem]";
    if (state === "correct")
      return `${base} border-good bg-good/20 text-good shadow-[0_0_18px_-6px_rgb(52_211_153/0.8)]`;
    if (state === "incorrect")
      return `${base} border-bad bg-bad/20 text-bad shadow-[0_0_18px_-6px_rgb(251_113_133/0.8)]`;
    return `${base} border-line-strong bg-surface-2 text-white focus:border-brand focus:ring-2 focus:ring-brand/30`;
  };

  const faceColor = FACE_COLORS[face];
  const chipText = LIGHT_FACES.includes(face) ? "#0a0a0a" : "#ffffff";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl text-base font-extrabold shadow-md ring-1 ring-black/20"
          style={{ backgroundColor: faceColor, color: chipText }}
          aria-hidden
        >
          {face}
        </span>
        <div className="flex items-center gap-2">
          <label htmlFor="face-drill-select" className="text-sm text-muted">
            Face
          </label>
          <div className="relative">
            <select
              id="face-drill-select"
              value={face}
              disabled={practiceAllFaces || disabled}
              onChange={(e) => onFaceChange?.(e.target.value as Face)}
              className="min-h-11 appearance-none rounded-xl border border-line-strong bg-surface-2 py-2 pl-3 pr-9 text-sm font-medium text-white transition-colors hover:border-brand/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ALL_FACES.map((f) => (
                <option key={f} value={f}>
                  {f} — {FACE_NAMES[f]}
                </option>
              ))}
            </select>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-muted">
        Enter the four letters clockwise from top-left.
        <span className="ml-1 text-faint">Example for U: A B / D C</span>
      </p>

      <div
        className="mx-auto w-fit rounded-2xl border border-line p-4"
        style={{
          background: `linear-gradient(160deg, color-mix(in srgb, ${faceColor} 9%, var(--surface-1)), var(--surface-0))`,
        }}
      >
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
        className="min-h-11 w-full rounded-xl bg-gradient-to-r from-brand to-brand-strong px-4 py-3 font-semibold text-surface-0 shadow-lg shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:from-surface-3 disabled:to-surface-3 disabled:text-faint disabled:shadow-none"
      >
        Check Face
      </button>

      {feedback && (
        <div className="animate-fade-in-up rounded-2xl border border-line bg-surface-0/70 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-faint">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: faceColor }}
            />
            Answer key · {face} face
          </div>
          <div className="grid w-fit grid-cols-2 gap-1.5">
            {getFaceLetterGrid(face)
              .flat()
              .map((letter, i) => (
                <span
                  key={i}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 font-mono text-lg font-bold text-white"
                >
                  {letter}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
