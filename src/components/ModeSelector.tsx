"use client";

import type { TrainingMode } from "@/types/cube";

type ModeMeta = {
  id: TrainingMode;
  label: string;
  description: string;
  shortcut: string;
  accent: string;
  glow: string;
  icon: (props: { className?: string }) => React.ReactNode;
};

const MODES: ModeMeta[] = [
  {
    id: "find-letter",
    label: "Find the Letter",
    description: "Click the sticker matching the prompt",
    shortcut: "1",
    accent: "var(--brand)",
    glow: "63 185 80",
    icon: TargetIcon,
  },
  {
    id: "name-sticker",
    label: "Name the Sticker",
    description: "Type the letter for the highlighted sticker",
    shortcut: "2",
    accent: "var(--face-b)",
    glow: "37 99 235",
    icon: KeyboardIcon,
  },
  {
    id: "face-drill",
    label: "Face Drill",
    description: "Fill in all four letters for a face",
    shortcut: "3",
    accent: "var(--face-l)",
    glow: "249 115 22",
    icon: GridIcon,
  },
];

interface ModeSelectorProps {
  mode: TrainingMode;
  onChange: (mode: TrainingMode) => void;
}

export default function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Training mode"
      className="grid w-full grid-cols-3 gap-1.5 rounded-2xl border border-line bg-surface-0/70 p-1.5 backdrop-blur sm:w-auto sm:gap-2"
    >
      {MODES.map((m) => {
        const active = mode === m.id;
        const Icon = m.icon;
        return (
          <button
            key={m.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(m.id)}
            title={`${m.label} — press ${m.shortcut}`}
            className={`group relative flex min-h-11 items-center gap-2.5 overflow-hidden rounded-xl px-2.5 py-2 text-left transition-all duration-200 sm:px-3.5 ${
              active
                ? "text-white shadow-lg"
                : "text-muted hover:bg-surface-2/60 hover:text-foreground"
            }`}
            style={
              active
                ? {
                    background: `linear-gradient(160deg, rgb(${m.glow} / 0.22), rgb(${m.glow} / 0.06))`,
                    boxShadow: `0 0 0 1px rgb(${m.glow} / 0.5) inset, 0 10px 28px -16px rgb(${m.glow} / 0.9)`,
                  }
                : undefined
            }
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
              style={{
                background: active
                  ? `rgb(${m.glow} / 0.2)`
                  : "color-mix(in srgb, var(--surface-2) 80%, transparent)",
                color: active ? m.accent : undefined,
              }}
            >
              <Icon className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-semibold leading-tight">
                  {m.label}
                </span>
              </span>
              <span className="hidden truncate text-[11px] leading-tight text-faint sm:block">
                {m.description}
              </span>
            </span>
            <kbd
              className="ml-auto hidden h-5 min-w-5 items-center justify-center rounded border border-line bg-surface-0/80 px-1 font-mono text-[10px] text-faint sm:flex"
              aria-hidden
            >
              {m.shortcut}
            </kbd>
          </button>
        );
      })}
    </div>
  );
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.2" />
      <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

function KeyboardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path strokeLinecap="round" d="M7 10h0M11 10h0M15 10h0M8.5 14h7" />
    </svg>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.6" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="1.6" />
    </svg>
  );
}
