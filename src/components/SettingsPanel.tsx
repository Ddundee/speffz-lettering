"use client";

import { useEffect, useRef } from "react";
import type { LetterDisplayMode, TrainerSettings } from "@/lib/settings";

interface SettingsPanelProps {
  open: boolean;
  settings: TrainerSettings;
  onClose: () => void;
  onChange: (settings: TrainerSettings) => void;
}

export default function SettingsPanel({
  open,
  settings,
  onClose,
  onChange,
}: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const setMode = (letterDisplay: LetterDisplayMode) => {
    onChange({ letterDisplay });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close settings"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-labelledby="settings-title"
        className="relative z-10 flex h-full w-full max-w-sm flex-col border-l border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 id="settings-title" className="text-lg font-bold text-white">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <fieldset>
            <legend className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Letter display default
            </legend>
            <p className="mt-1 text-sm text-slate-500">
              Controls whether letters appear on cube stickers during training. The
              header toggle temporarily overrides this for the current visit.
            </p>
            <div className="mt-4 space-y-2">
              <ModeOption
                id="learning"
                title="Learning mode"
                description="Show letters on stickers — helpful while memorizing."
                selected={settings.letterDisplay === "learning"}
                onSelect={() => setMode("learning")}
              />
              <ModeOption
                id="test"
                title="Test mode"
                description="Hide letters on stickers — default for real training."
                selected={settings.letterDisplay === "test"}
                onSelect={() => setMode("test")}
              />
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  );
}

function ModeOption({
  id,
  title,
  description,
  selected,
  onSelect,
}: {
  id: string;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition ${
        selected
          ? "border-cyan-500/60 bg-cyan-500/10"
          : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
            selected ? "border-cyan-400 bg-cyan-400" : "border-slate-600"
          }`}
        >
          {selected && <span className="h-2 w-2 rounded-full bg-slate-950" />}
        </span>
        <div>
          <div className="font-semibold text-white">{title}</div>
          <div className="text-sm text-slate-400">{description}</div>
        </div>
      </div>
    </button>
  );
}
