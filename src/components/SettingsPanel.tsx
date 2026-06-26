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
        className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="glass-raised relative z-10 flex h-full w-full max-w-sm translate-x-0 flex-col border-l border-line-strong shadow-2xl animate-fade-in-up"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/15 text-brand">
              <GearIcon />
            </span>
            <h2 id="settings-title" className="text-lg font-bold text-white">
              Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-white"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="scroll-slim flex-1 overflow-y-auto px-5 py-6">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
              Letter display default
            </legend>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Controls whether letters appear on cube stickers during training. The
              header toggle temporarily overrides this for the current visit.
            </p>
            <div className="mt-4 space-y-2.5">
              <ModeOption
                title="Learning mode"
                description="Show letters on stickers — helpful while memorizing."
                selected={settings.letterDisplay === "learning"}
                onSelect={() => setMode("learning")}
              />
              <ModeOption
                title="Test mode"
                description="Hide letters on stickers — default for real training."
                selected={settings.letterDisplay === "test"}
                onSelect={() => setMode("test")}
              />
            </div>
          </fieldset>
        </div>

        <div className="border-t border-line px-5 py-4 text-xs text-faint">
          Preferences are saved to this browser.
        </div>
      </div>
    </div>
  );
}

function ModeOption({
  title,
  description,
  selected,
  onSelect,
}: {
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-xl border p-4 text-left transition-all duration-200 ${
        selected
          ? "border-brand/60 bg-brand/10 shadow-[0_0_0_1px_rgb(45_212_191/0.35)_inset]"
          : "border-line bg-surface-1/60 hover:border-line-strong hover:bg-surface-2/60"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            selected ? "border-brand bg-brand" : "border-faint"
          }`}
        >
          {selected && <span className="h-2 w-2 rounded-full bg-surface-0" />}
        </span>
        <div>
          <div className="font-semibold text-white">{title}</div>
          <div className="text-sm text-muted">{description}</div>
        </div>
      </div>
    </button>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
      />
    </svg>
  );
}
