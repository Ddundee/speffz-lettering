"use client";

import { useEffect, useRef } from "react";
import type { LetterDisplayMode, TrainerSettings } from "@/lib/settings";

interface SettingsPanelProps {
  open: boolean;
  settings: TrainerSettings;
  onClose: () => void;
  onChange: (settings: TrainerSettings) => void;
}

const OPTIONS: { value: LetterDisplayMode; title: string; description: string }[] = [
  {
    value: "learning",
    title: "Learning mode",
    description: "Show letters on stickers — helpful while memorizing.",
  },
  {
    value: "test",
    title: "Test mode",
    description: "Hide letters on stickers — default for real training.",
  },
];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function SettingsPanel({
  open,
  settings,
  onClose,
  onChange,
}: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Esc-to-close (kept working independently of focus management).
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Focus management (hand-rolled, no library):
  // (a) move focus into the panel on open, (b) trap Tab/Shift+Tab within it,
  // (c) restore focus to the triggering element on close/unmount.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panel?.focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (el) =>
          el.tabIndex !== -1 &&
          (el.offsetParent !== null || el === document.activeElement),
      );
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const setMode = (letterDisplay: LetterDisplayMode) => {
    onChange({ letterDisplay });
  };

  const selectedIndex = OPTIONS.findIndex(
    (o) => o.value === settings.letterDisplay,
  );

  // Arrow-key selection within the radio group (WAI-ARIA radio pattern).
  const handleRadioKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let next: number | null = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      next = (index + 1) % OPTIONS.length;
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      next = (index - 1 + OPTIONS.length) % OPTIONS.length;
    }
    if (next === null) return;
    e.preventDefault();
    setMode(OPTIONS[next].value);
    radioRefs.current[next]?.focus();
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
        tabIndex={-1}
        className="glass-raised relative z-10 flex h-full w-full max-w-sm translate-x-0 flex-col border-l border-line-strong shadow-2xl outline-none animate-fade-in-up"
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
          <p
            id="letter-display-label"
            className="text-xs font-semibold uppercase tracking-[0.14em] text-faint"
          >
            Letter display default
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Controls whether letters appear on cube stickers during training. The
            header toggle temporarily overrides this for the current visit.
          </p>
          <div
            role="radiogroup"
            aria-labelledby="letter-display-label"
            className="mt-4 space-y-2.5"
          >
            {OPTIONS.map((o, i) => (
              <ModeOption
                key={o.value}
                ref={(el) => {
                  radioRefs.current[i] = el;
                }}
                title={o.title}
                description={o.description}
                selected={settings.letterDisplay === o.value}
                tabbable={i === (selectedIndex === -1 ? 0 : selectedIndex)}
                onSelect={() => setMode(o.value)}
                onKeyDown={(e) => handleRadioKeyDown(e, i)}
              />
            ))}
          </div>
        </div>

        <div className="border-t border-line px-5 py-4 text-xs text-faint">
          Preferences are saved to this browser.
        </div>
      </div>
    </div>
  );
}

function ModeOption({
  ref,
  title,
  description,
  selected,
  tabbable,
  onSelect,
  onKeyDown,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  title: string;
  description: string;
  selected: boolean;
  tabbable: boolean;
  onSelect: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabbable ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={`w-full rounded-xl border p-4 text-left transition-all duration-200 ${
        selected
          ? "border-brand/60 bg-brand/10 shadow-[0_0_0_1px_rgb(63_185_80/0.35)_inset]"
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
