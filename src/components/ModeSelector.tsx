"use client";

import type { TrainingMode } from "@/types/cube";

const MODES: { id: TrainingMode; label: string; description: string }[] = [
  {
    id: "find-letter",
    label: "Find the Letter",
    description: "Click the sticker matching the prompt",
  },
  {
    id: "name-sticker",
    label: "Name the Sticker",
    description: "Type the letter for the highlighted sticker",
  },
  {
    id: "face-drill",
    label: "Face Drill",
    description: "Fill in all four letters for a face",
  },
];

interface ModeSelectorProps {
  mode: TrainingMode;
  onChange: (mode: TrainingMode) => void;
}

export default function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {MODES.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={`rounded-xl border px-4 py-2 text-left transition-all ${
              active
                ? "border-cyan-400 bg-cyan-500/15 text-cyan-100 shadow-lg shadow-cyan-500/10"
                : "border-slate-600 bg-slate-800/60 text-slate-300 hover:border-slate-500 hover:bg-slate-800"
            }`}
          >
            <div className="text-sm font-semibold">{m.label}</div>
            <div className="hidden text-xs text-slate-400 sm:block">{m.description}</div>
          </button>
        );
      })}
    </div>
  );
}
