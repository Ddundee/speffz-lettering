"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import ModeSelector from "@/components/ModeSelector";
import StatsPanel from "@/components/StatsPanel";
import FaceDrill from "@/components/FaceDrill";
import SettingsPanel from "@/components/SettingsPanel";
import {
  filterStickers,
  filterStickersByLetters,
  pickRandomFace,
  pickRandomSticker,
} from "@/lib/stickers";
import {
  buildTimedSummary,
  loadStats,
  recordFaceAttempt,
  recordLetterAttempt,
  resetStats,
  saveStats,
} from "@/lib/stats";
import {
  loadSettings,
  saveSettings,
  settingsShowLetters,
  type TrainerSettings,
} from "@/lib/settings";
import type {
  Face,
  FeedbackState,
  PersistedStats,
  Sticker,
  StickerFilter,
  StickerHighlight,
  StickerPosition,
  TimedSummary,
  TrainingMode,
} from "@/types/cube";

const RubiksCube3D = dynamic(() => import("@/components/RubiksCube3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 rounded-3xl border border-line-strong bg-[radial-gradient(120%_120%_at_50%_0%,#141a2e_0%,#080b14_70%)] text-muted sm:min-h-[320px]">
      <span className="flex h-10 w-10 animate-[float-soft_2s_ease-in-out_infinite] items-center justify-center rounded-xl border border-line-strong bg-surface-2">
        <span className="grid grid-cols-2 gap-0.5">
          <span className="h-2 w-2 rounded-[2px] bg-face-f" />
          <span className="h-2 w-2 rounded-[2px] bg-face-r" />
          <span className="h-2 w-2 rounded-[2px] bg-face-b" />
          <span className="h-2 w-2 rounded-[2px] bg-face-d" />
        </span>
      </span>
      <span className="text-sm">Loading cube…</span>
    </div>
  ),
});

const FEEDBACK_DELAY_MS = 1200;
const TIMED_DURATION_SEC = 60;

const MODE_SHORTCUTS: Record<string, TrainingMode> = {
  "1": "find-letter",
  "2": "name-sticker",
  "3": "face-drill",
};

const MODE_META: Record<
  TrainingMode,
  { title: string; hint: string; accent: string; glow: string; icon: React.ReactNode }
> = {
  "find-letter": {
    title: "Find the Letter",
    hint: "Click the sticker that matches the prompt",
    accent: "var(--brand)",
    glow: "45 212 191",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4.5 w-4.5" aria-hidden>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3.2" />
        <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
    ),
  },
  "name-sticker": {
    title: "Name the Sticker",
    hint: "Type the letter for the highlighted sticker",
    accent: "var(--face-b)",
    glow: "37 99 235",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4.5 w-4.5" aria-hidden>
        <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
        <path strokeLinecap="round" d="M7 10h0M11 10h0M15 10h0M8.5 14h7" />
      </svg>
    ),
  },
  "face-drill": {
    title: "Face Drill",
    hint: "Fill in all four letters for the face",
    accent: "var(--face-l)",
    glow: "255 122 24",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4.5 w-4.5" aria-hidden>
        <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.6" />
        <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.6" />
        <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.6" />
        <rect x="13" y="13" width="7.5" height="7.5" rx="1.6" />
      </svg>
    ),
  },
};

export default function CubeTrainer() {
  const [mode, setMode] = useState<TrainingMode>("find-letter");
  const [stats, setStats] = useState<PersistedStats | null>(null);
  const [settings, setSettings] = useState<TrainerSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showLettersOverride, setShowLettersOverride] = useState<boolean | null>(null);
  const [filter, setFilter] = useState<StickerFilter>("all");
  const [weakLetterFilter, setWeakLetterFilter] = useState<string[] | null>(null);
  const [timedMode, setTimedMode] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timedSummary, setTimedSummary] = useState<TimedSummary | null>(null);
  const [resetViewToken, setResetViewToken] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const [roundCorrect, setRoundCorrect] = useState(0);
  const [roundIncorrect, setRoundIncorrect] = useState(0);
  const roundLettersRef = useRef<string[]>([]);
  const roundTimesRef = useRef<Record<string, number[]>>({});
  const roundMissedCountsRef = useRef<Record<string, number>>({});

  const [targetSticker, setTargetSticker] = useState<Sticker | null>(null);
  const [targetLetter, setTargetLetter] = useState<string>("");
  const [feedback, setFeedback] = useState<FeedbackState>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [highlights, setHighlights] = useState<StickerHighlight[]>([]);
  const [inputLocked, setInputLocked] = useState(false);

  const [letterInput, setLetterInput] = useState("");
  const promptStartRef = useRef<number>(Date.now());
  const letterInputRef = useRef<HTMLInputElement>(null);

  const [drillFace, setDrillFace] = useState<Face>("U");
  const [practiceAllFaces, setPracticeAllFaces] = useState(false);
  const [faceFeedback, setFaceFeedback] = useState<
    Record<StickerPosition, "idle" | "correct" | "incorrect"> | null
  >(null);

  const basePool = filterStickers(filter);
  const pool = weakLetterFilter
    ? filterStickersByLetters(basePool, weakLetterFilter)
    : basePool;

  const effectiveShowLetters =
    showLettersOverride ?? (settings ? settingsShowLetters(settings) : false);

  useEffect(() => {
    setStats(loadStats());
    setSettings(loadSettings());
  }, []);

  const persistStats = useCallback((updated: PersistedStats) => {
    setStats(updated);
    saveStats(updated);
  }, []);

  const persistSettings = useCallback((updated: TrainerSettings) => {
    setSettings(updated);
    saveSettings(updated);
    setShowLettersOverride(null);
  }, []);

  const startNewPrompt = useCallback(
    (excludeStickerId?: string) => {
      if (pool.length === 0) return;

      setFeedback("idle");
      setFeedbackMessage("");
      setHighlights([]);
      setInputLocked(false);
      setLetterInput("");
      setFaceFeedback(null);
      promptStartRef.current = Date.now();

      if (mode === "find-letter") {
        const sticker = pickRandomSticker(pool, excludeStickerId);
        setTargetSticker(sticker);
        setTargetLetter(sticker.letter);
      } else if (mode === "name-sticker") {
        const sticker = pickRandomSticker(pool, excludeStickerId);
        setTargetSticker(sticker);
        setTargetLetter(sticker.letter);
        setHighlights([{ stickerId: sticker.id, variant: "prompt" }]);
      } else {
        const face = practiceAllFaces
          ? pickRandomFace(drillFace)
          : drillFace;
        setDrillFace(face);
        setTargetSticker(null);
        setTargetLetter("");
      }
    },
    [mode, pool, practiceAllFaces, drillFace],
  );

  const endTimedRound = useCallback(() => {
    if (!stats) return;
    const summary = buildTimedSummary(
      stats,
      roundLettersRef.current,
      roundTimesRef.current,
      roundCorrect,
      roundIncorrect,
      roundMissedCountsRef.current,
    );
    setTimedSummary(summary);
    setTimerSeconds(null);
    setInputLocked(true);
    const updated = {
      ...stats,
      session: { ...stats.session, timedRounds: stats.session.timedRounds + 1 },
    };
    persistStats(updated);
  }, [stats, roundCorrect, roundIncorrect, persistStats]);

  useEffect(() => {
    if (!stats) return;
    startNewPrompt();
  }, [mode, filter, practiceAllFaces, weakLetterFilter, stats]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!timedMode || timerSeconds === null) return;
    if (timerSeconds <= 0) {
      endTimedRound();
      return;
    }
    const id = window.setTimeout(() => setTimerSeconds((s) => (s !== null ? s - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [timedMode, timerSeconds, endTimedRound]);

  // Keep the Name-the-Sticker input focused for uninterrupted keyboard-only
  // practice. The input stays mounted and is only temporarily disabled during
  // feedback, so refocus it whenever a new prompt re-enables it. Only steal
  // focus when that input is the active prompt — not in other modes, and not
  // while the settings drawer or the timed summary is up.
  useEffect(() => {
    if (mode !== "name-sticker" || inputLocked) return;
    if (settingsOpen || timedSummary) return;
    letterInputRef.current?.focus();
  }, [mode, inputLocked, settingsOpen, timedSummary, targetSticker?.id]);

  const recordAttempt = useCallback(
    (letter: string, correct: boolean) => {
      if (!stats) return;
      const timeMs = Date.now() - promptStartRef.current;
      roundLettersRef.current.push(letter);
      if (!roundTimesRef.current[letter]) roundTimesRef.current[letter] = [];
      roundTimesRef.current[letter].push(timeMs);
      const updated = recordLetterAttempt(stats, letter, correct, timeMs);
      persistStats(updated);
      if (correct) setRoundCorrect((c) => c + 1);
      else {
        setRoundIncorrect((c) => c + 1);
        roundMissedCountsRef.current[letter] =
          (roundMissedCountsRef.current[letter] ?? 0) + 1;
      }
    },
    [stats, persistStats],
  );

  const advanceAfterFeedback = useCallback(
    (delay = FEEDBACK_DELAY_MS) => {
      setInputLocked(true);
      window.setTimeout(() => {
        if (timedMode && timerSeconds !== null && timerSeconds > 0) {
          startNewPrompt(targetSticker?.id);
        } else if (!timedMode) {
          startNewPrompt(targetSticker?.id);
        }
      }, delay);
    },
    [timedMode, timerSeconds, startNewPrompt, targetSticker?.id],
  );

  const handleStickerClick = useCallback(
    (sticker: Sticker) => {
      if (mode !== "find-letter" || inputLocked || !targetLetter) return;
      setInputLocked(true);

      const correct = sticker.letter === targetLetter;
      recordAttempt(targetLetter, correct);

      if (correct) {
        setFeedback("correct");
        setFeedbackMessage(`Correct! ${targetLetter} is on ${sticker.face}`);
        setHighlights([{ stickerId: sticker.id, variant: "correct" }]);
      } else {
        setFeedback("incorrect");
        setFeedbackMessage(
          `Wrong — ${targetLetter} is on the ${targetSticker?.face ?? "?"} face`,
        );
        setHighlights([
          { stickerId: sticker.id, variant: "incorrect" },
          ...(targetSticker
            ? [{ stickerId: targetSticker.id, variant: "hint" as const }]
            : []),
        ]);
      }
      advanceAfterFeedback();
    },
    [
      mode,
      inputLocked,
      targetLetter,
      targetSticker,
      recordAttempt,
      advanceAfterFeedback,
    ],
  );

  const handleLetterSubmit = useCallback(() => {
    if (mode !== "name-sticker" || inputLocked || !targetSticker) return;

    const guess = letterInput.trim().toUpperCase();
    if (!guess) return;
    setInputLocked(true);

    const correct = guess === targetLetter;
    recordAttempt(targetLetter, correct);

    if (correct) {
      setFeedback("correct");
      setFeedbackMessage(`Correct! That sticker is ${targetLetter}`);
      setHighlights([{ stickerId: targetSticker.id, variant: "correct" }]);
    } else {
      setFeedback("incorrect");
      setFeedbackMessage(`Wrong — the answer is ${targetLetter}`);
      setHighlights([{ stickerId: targetSticker.id, variant: "hint" }]);
    }
    advanceAfterFeedback();
  }, [
    mode,
    inputLocked,
    targetSticker,
    letterInput,
    targetLetter,
    recordAttempt,
    advanceAfterFeedback,
  ]);

  const handleFaceSubmit = useCallback(
    (results: { position: StickerPosition; correct: boolean }[]) => {
      if (mode !== "face-drill" || inputLocked || !stats) return;
      setInputLocked(true);

      const correctCount = results.filter((r) => r.correct).length;
      const incorrectCount = results.length - correctCount;
      const updated = recordFaceAttempt(stats, drillFace, correctCount, incorrectCount);
      persistStats(updated);

      const fb = Object.fromEntries(
        results.map((r) => [
          r.position,
          r.correct ? "correct" : "incorrect",
        ]),
      ) as Record<StickerPosition, "idle" | "correct" | "incorrect">;
      setFaceFeedback(fb);

      if (incorrectCount === 0) {
        setRoundCorrect((c) => c + 1);
        setFeedback("correct");
        setFeedbackMessage(`Perfect! All letters on ${drillFace} face correct.`);
      } else {
        setRoundIncorrect((c) => c + 1);
        setFeedback("incorrect");
        setFeedbackMessage(
          `${incorrectCount} wrong on ${drillFace} face — review the answer key.`,
        );
      }

      window.setTimeout(() => {
        if (timedMode && timerSeconds !== null && timerSeconds > 0) {
          startNewPrompt();
        } else if (!timedMode) {
          startNewPrompt();
        }
      }, FEEDBACK_DELAY_MS + 400);
    },
    [
      mode,
      inputLocked,
      stats,
      drillFace,
      persistStats,
      timedMode,
      timerSeconds,
      startNewPrompt,
    ],
  );

  const handleNewRound = useCallback(() => {
    setRoundCorrect(0);
    setRoundIncorrect(0);
    roundLettersRef.current = [];
    roundTimesRef.current = {};
    roundMissedCountsRef.current = {};
    setTimedSummary(null);
    setInputLocked(false);
    if (timedMode) {
      setTimerSeconds(TIMED_DURATION_SEC);
    } else {
      setTimerSeconds(null);
    }
    startNewPrompt();
  }, [timedMode, startNewPrompt]);

  const handleResetStats = useCallback(() => {
    const fresh = resetStats();
    setStats(fresh);
    setRoundCorrect(0);
    setRoundIncorrect(0);
    roundLettersRef.current = [];
    roundTimesRef.current = {};
    roundMissedCountsRef.current = {};
    setTimedSummary(null);
    startNewPrompt();
  }, [startNewPrompt]);

  const handleModeChange = useCallback((m: TrainingMode) => {
    setMode(m);
    setTimedSummary(null);
    setRoundCorrect(0);
    setRoundIncorrect(0);
    roundLettersRef.current = [];
    roundTimesRef.current = {};
    if (m === "face-drill") setWeakLetterFilter(null);
  }, []);

  const handleToggleLetters = useCallback(() => {
    setShowLettersOverride((prev) => {
      const current = prev ?? (settings ? settingsShowLetters(settings) : false);
      return !current;
    });
  }, [settings]);

  const handleToggleTimedMode = useCallback(() => {
    setTimedMode((prev) => {
      const next = !prev;
      setTimedSummary(null);
      if (next) {
        setTimerSeconds(TIMED_DURATION_SEC);
        setRoundCorrect(0);
        setRoundIncorrect(0);
        roundLettersRef.current = [];
        roundTimesRef.current = {};
        roundMissedCountsRef.current = {};
      } else {
        setTimerSeconds(null);
      }
      return next;
    });
  }, []);

  const handlePracticeWeakLetters = useCallback((letters: string[]) => {
    setWeakLetterFilter(letters.slice(0, 6));
    setMode("find-letter");
    setTimedSummary(null);
    setInputLocked(false);
  }, []);

  const dismissSummary = useCallback(() => {
    setTimedSummary(null);
    setInputLocked(false);
    startNewPrompt();
  }, [startNewPrompt]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if (e.key === "Escape") {
        if (settingsOpen) {
          setSettingsOpen(false);
          return;
        }
        if (timedSummary) {
          dismissSummary();
          return;
        }
        if (!typing) {
          (document.activeElement as HTMLElement)?.blur();
        }
        return;
      }

      if (typing && !e.key.startsWith("F")) return;

      if (MODE_SHORTCUTS[e.key]) {
        e.preventDefault();
        handleModeChange(MODE_SHORTCUTS[e.key]);
        return;
      }
      if (e.key === "F1") {
        e.preventDefault();
        handleModeChange("find-letter");
      } else if (e.key === "F2") {
        e.preventDefault();
        handleModeChange("name-sticker");
      } else if (e.key === "F3") {
        e.preventDefault();
        handleModeChange("face-drill");
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setResetViewToken((t) => t + 1);
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        handleNewRound();
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        handleToggleLetters();
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        handleToggleTimedMode();
      } else if (e.key === "?" && !typing) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    settingsOpen,
    timedSummary,
    dismissSummary,
    handleModeChange,
    handleNewRound,
    handleToggleLetters,
    handleToggleTimedMode,
  ]);

  const focusFace = mode === "face-drill" ? drillFace : null;
  const lettersOverridden = showLettersOverride !== null;

  if (!stats || !settings) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        <div className="flex flex-col items-center gap-3">
          <CubeMark className="h-10 w-10 animate-[float-soft_2s_ease-in-out_infinite]" />
          <span className="text-sm">Loading trainer…</span>
        </div>
      </div>
    );
  }

  const activeMode = MODE_META[mode];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface-1/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto max-w-7xl px-4 py-3.5 sm:px-6">
          <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CubeMark className="h-10 w-10 shrink-0" />
                <div>
                  <h1 className="text-lg font-extrabold leading-none tracking-tight sm:text-xl">
                    <span className="text-sheen">Speffz Trainer</span>
                  </h1>
                  <p className="mt-1 text-xs text-muted sm:text-[13px]">
                    Blind cube lettering for 3×3 BLD &amp; Old Pochmann
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2/60 text-muted transition-colors hover:border-line-strong hover:text-white lg:hidden"
                aria-label="Open settings"
              >
                <GearIcon />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
              <ModeSelector mode={mode} onChange={handleModeChange} />
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="hidden h-11 items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3.5 text-sm font-medium text-muted transition-colors hover:border-line-strong hover:text-white lg:flex"
                aria-label="Open settings"
              >
                <GearIcon />
                Settings
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <ControlButton onClick={handleNewRound} icon="refresh" hint="N">
            New Round
          </ControlButton>
          <ControlButton onClick={() => setResetViewToken((t) => t + 1)} icon="view" hint="R">
            Reset View
          </ControlButton>
          <ControlButton active={effectiveShowLetters} pressed={effectiveShowLetters} onClick={handleToggleLetters} icon="eye" hint="L">
            {effectiveShowLetters ? "Hide Letters" : "Show Letters"}
            {lettersOverridden && (
              <span className="ml-1 rounded bg-white/10 px-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                session
              </span>
            )}
          </ControlButton>
          <ControlButton active={timedMode} pressed={timedMode} onClick={handleToggleTimedMode} icon="timer" hint="T">
            60s Timed
          </ControlButton>
          <ControlButton variant="danger" onClick={handleResetStats} icon="trash">
            Reset Stats
          </ControlButton>
          <ControlButton pressed={shortcutsOpen} onClick={() => setShortcutsOpen((v) => !v)} icon="keyboard" hint="?">
            Shortcuts
          </ControlButton>
        </div>

        {weakLetterFilter && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-foreground animate-fade-in-up">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/20 text-brand">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
              </svg>
            </span>
            <span>
              Drilling weak letters:{" "}
              <span className="font-mono font-bold tracking-widest text-brand">
                {weakLetterFilter.join(" ")}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setWeakLetterFilter(null)}
              className="ml-auto min-h-11 rounded-lg border border-line bg-surface-2/60 px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-white"
            >
              Clear filter
            </button>
          </div>
        )}

        {shortcutsOpen && <ShortcutLegend onClose={() => setShortcutsOpen(false)} />}

        <div className="grid flex-1 gap-4 sm:gap-6 lg:grid-cols-[1.15fr_1fr]">
          <section className="order-1 flex min-h-0 flex-col gap-3">
            <div className="relative h-[300px] flex-1 sm:h-[380px] md:h-[440px] lg:h-auto lg:min-h-[480px]">
              {timedMode && (
                <div className="absolute right-3 top-3 z-20">
                  <TimerBadge seconds={timerSeconds} />
                </div>
              )}
              <RubiksCube3D
                onStickerClick={handleStickerClick}
                highlights={highlights}
                showLetters={effectiveShowLetters}
                focusFace={focusFace}
                disabled={inputLocked || mode === "face-drill"}
                resetViewToken={resetViewToken}
              />
            </div>
          </section>

          <section className="order-2 flex min-h-0 flex-col space-y-4 sm:space-y-5">
            <div className="glass-raised rounded-3xl p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{
                    background: `rgb(${activeMode.glow} / 0.16)`,
                    color: activeMode.accent,
                  }}
                >
                  {activeMode.icon}
                </span>
                <div>
                  <p className="text-[13px] font-bold leading-tight text-white">
                    {activeMode.title}
                  </p>
                  <p className="text-[11px] leading-tight text-faint">
                    {activeMode.hint}
                  </p>
                </div>
              </div>

              {mode !== "face-drill" && (
                <FilterBar filter={filter} onChange={setFilter} />
              )}

              {mode === "face-drill" && (
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface-0/50 px-3 py-2 text-sm text-muted transition-colors hover:border-line-strong">
                  <input
                    type="checkbox"
                    checked={practiceAllFaces}
                    onChange={(e) => setPracticeAllFaces(e.target.checked)}
                    className="h-5 w-5 rounded border-line-strong accent-[var(--brand)]"
                  />
                  Practice all faces (random order)
                </label>
              )}

              <div
                className={`mt-4 rounded-2xl border p-4 transition-all sm:mt-5 ${
                  feedback === "correct"
                    ? "animate-pulse-once border-good/50 bg-good/10"
                    : feedback === "incorrect"
                      ? "animate-shake border-bad/50 bg-bad/10"
                      : "border-line bg-surface-0/50"
                }`}
              >
                {mode === "find-letter" && (
                  <div className="flex flex-col items-center py-2 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
                      Find the letter
                    </p>
                    <div
                      key={targetLetter || "empty"}
                      className="mt-3 flex h-28 w-28 animate-pop-in items-center justify-center rounded-3xl border border-line-strong bg-[radial-gradient(120%_120%_at_50%_0%,var(--surface-2),var(--surface-0))] shadow-[0_18px_40px_-22px_rgb(45_212_191/0.7)]"
                    >
                      <span className="bg-gradient-to-b from-white to-brand bg-clip-text font-mono text-6xl font-black text-transparent">
                        {targetLetter || "—"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-muted">
                      Click the matching sticker on the cube
                    </p>
                  </div>
                )}

                {mode === "name-sticker" && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
                      Name the highlighted sticker
                    </p>
                    <input
                      ref={letterInputRef}
                      type="text"
                      value={letterInput}
                      disabled={inputLocked}
                      maxLength={1}
                      placeholder="?"
                      onChange={(e) =>
                        setLetterInput(e.target.value.slice(-1).toUpperCase())
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleLetterSubmit();
                      }}
                      className="mt-3 min-h-11 w-full rounded-2xl border border-line-strong bg-surface-0/60 px-4 py-4 text-center font-mono text-5xl font-black uppercase tracking-widest text-white outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/25"
                      autoFocus
                    />
                    <button
                      type="button"
                      disabled={inputLocked || !letterInput}
                      onClick={handleLetterSubmit}
                      className="mt-3 min-h-11 w-full rounded-xl bg-gradient-to-r from-brand to-brand-strong py-3 font-semibold text-surface-0 shadow-lg shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:from-surface-3 disabled:to-surface-3 disabled:text-faint disabled:shadow-none"
                    >
                      Submit <span className="opacity-70">(Enter)</span>
                    </button>
                  </div>
                )}

                {mode === "face-drill" && (
                  <FaceDrill
                    face={drillFace}
                    practiceAllFaces={practiceAllFaces}
                    onSubmit={handleFaceSubmit}
                    feedback={faceFeedback}
                    disabled={inputLocked}
                    onFaceChange={setDrillFace}
                  />
                )}

                {feedbackMessage && (
                  <p
                    className={`mt-4 flex items-center gap-2 text-sm font-medium ${
                      feedback === "correct" ? "text-good" : "text-bad"
                    }`}
                  >
                    <span aria-hidden>{feedback === "correct" ? "✓" : "✕"}</span>
                    {feedbackMessage}
                  </p>
                )}
              </div>
            </div>

            {timedSummary && (
              <TimedSummaryCard summary={timedSummary} onDismiss={dismissSummary} />
            )}

            <StatsPanel
              stats={stats}
              roundCorrect={roundCorrect}
              roundIncorrect={roundIncorrect}
              timerSeconds={timerSeconds}
              timedMode={timedMode}
              onPracticeWeakLetters={handlePracticeWeakLetters}
            />
          </section>
        </div>
      </main>

      <footer className="border-t border-line px-4 py-3 text-center text-xs text-faint sm:px-6">
        <button
          type="button"
          onClick={() => setShortcutsOpen((v) => !v)}
          className="min-h-11 rounded-lg px-3 transition-colors hover:text-muted"
        >
          Press{" "}
          <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-brand">
            ?
          </kbd>{" "}
          for keyboard shortcuts
        </button>
      </footer>

      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onChange={persistSettings}
      />
    </div>
  );
}

/** Brand mark — a stylized cube using the six face colors. */
function CubeMark({ className }: { className?: string }) {
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-xl border border-line-strong bg-[radial-gradient(120%_120%_at_50%_0%,var(--surface-2),var(--surface-0))] shadow-[0_8px_22px_-12px_rgb(45_212_191/0.8)] ${className ?? ""}`}
      aria-hidden
    >
      <span className="grid grid-cols-2 gap-[3px]">
        <span className="h-2.5 w-2.5 rounded-[3px] bg-face-f shadow-[0_0_6px_-1px_var(--face-f)]" />
        <span className="h-2.5 w-2.5 rounded-[3px] bg-face-r shadow-[0_0_6px_-1px_var(--face-r)]" />
        <span className="h-2.5 w-2.5 rounded-[3px] bg-face-b shadow-[0_0_6px_-1px_var(--face-b)]" />
        <span className="h-2.5 w-2.5 rounded-[3px] bg-face-d shadow-[0_0_6px_-1px_var(--face-d)]" />
      </span>
    </span>
  );
}

/** Floating countdown badge shown over the cube in timed mode. */
function TimerBadge({ seconds }: { seconds: number | null | undefined }) {
  const value = seconds !== null && seconds !== undefined ? seconds : null;
  const low = value !== null && value <= 10;
  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold tabular-nums backdrop-blur-sm ${
        low
          ? "border-bad/50 bg-bad/15 text-bad"
          : "border-warn/40 bg-black/45 text-warn"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
        <circle cx="12" cy="13" r="8" />
        <path strokeLinecap="round" d="M12 9v4l2.5 2M9 2h6" />
      </svg>
      {value !== null ? `${value}s` : "—"}
    </div>
  );
}

function GearIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
      />
    </svg>
  );
}

function ShortcutLegend({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    ["1 / F1", "Find the Letter mode"],
    ["2 / F2", "Name the Sticker mode"],
    ["3 / F3", "Face Drill mode"],
    ["Enter", "Submit letter (name mode)"],
    ["R", "Reset cube view"],
    ["N", "New round"],
    ["L", "Toggle show/hide letters (session override)"],
    ["T", "Toggle 60s timed mode"],
    ["Esc", "Dismiss summary / clear focus"],
    ["?", "Toggle this legend"],
  ];

  return (
    <div className="glass-raised mb-4 rounded-2xl p-4 animate-fade-in-up sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-faint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-brand" aria-hidden>
            <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
            <path strokeLinecap="round" d="M7 10h0M11 10h0M15 10h0M8.5 14h7" />
          </svg>
          Keyboard shortcuts
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-lg border border-line bg-surface-2/60 px-3 text-xs font-medium text-muted transition-colors hover:text-white"
        >
          Close
        </button>
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">
        {shortcuts.map(([key, desc]) => (
          <div
            key={key}
            className="flex items-center gap-3 rounded-lg border border-line bg-surface-0/40 px-3 py-1.5 text-sm"
          >
            <kbd className="min-w-[4.25rem] rounded-md border border-line bg-surface-2 px-2 py-1 text-center font-mono text-xs font-semibold text-brand">
              {key}
            </kbd>
            <span className="text-muted">{desc}</span>
          </div>
        ))}
      </dl>
    </div>
  );
}

function FilterBar({
  filter,
  onChange,
}: {
  filter: StickerFilter;
  onChange: (f: StickerFilter) => void;
}) {
  const options: { id: StickerFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "edges", label: "Edges" },
    { id: "corners", label: "Corners" },
  ];
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
        Filter
      </span>
      <div className="inline-flex flex-1 rounded-xl border border-line bg-surface-0/60 p-1">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={filter === o.id}
            className={`min-h-11 flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              filter === o.id
                ? "bg-brand/15 text-brand shadow-[0_0_0_1px_rgb(45_212_191/0.4)_inset]"
                : "text-muted hover:text-white"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type ControlIcon = "refresh" | "view" | "eye" | "timer" | "trash" | "keyboard";

function ControlGlyph({ name }: { name: ControlIcon }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    className: "h-4 w-4",
    "aria-hidden": true,
  } as const;
  switch (name) {
    case "refresh":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-2.64-6.36M21 3v5h-5" />
        </svg>
      );
    case "view":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a9 9 0 100 18 9 9 0 000-18zM3.6 9h16.8M3.6 15h16.8M12 3c2.5 2.4 2.5 15.6 0 18M12 3c-2.5 2.4-2.5 15.6 0 18" />
        </svg>
      );
    case "eye":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="2.6" />
        </svg>
      );
    case "timer":
      return (
        <svg {...common}>
          <circle cx="12" cy="13" r="8" />
          <path strokeLinecap="round" d="M12 9v4l2.5 2M9 2h6" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
        </svg>
      );
    case "keyboard":
      return (
        <svg {...common}>
          <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
          <path strokeLinecap="round" d="M7 10h0M11 10h0M15 10h0M8.5 14h7" />
        </svg>
      );
  }
}

function ControlButton({
  children,
  onClick,
  active,
  variant,
  icon,
  hint,
  pressed,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  variant?: "danger";
  icon?: ControlIcon;
  hint?: string;
  pressed?: boolean;
}) {
  const base =
    "group inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all active:scale-[0.98]";
  const classes =
    variant === "danger"
      ? `${base} border-bad/30 bg-bad/5 text-bad hover:border-bad/50 hover:bg-bad/10`
      : active
        ? `${base} border-brand/50 bg-brand/15 text-brand shadow-[0_0_18px_-8px_rgb(45_212_191/0.9)]`
        : `${base} border-line bg-surface-2/50 text-muted hover:border-line-strong hover:text-white`;

  return (
    <button type="button" onClick={onClick} className={classes} aria-pressed={pressed}>
      {icon && <ControlGlyph name={icon} />}
      <span className="flex items-center">{children}</span>
      {hint && (
        <kbd
          className={`hidden h-5 min-w-5 items-center justify-center rounded border px-1 font-mono text-[10px] sm:flex ${
            active
              ? "border-brand/40 bg-brand/10 text-brand"
              : "border-line bg-surface-0/70 text-faint"
          }`}
          aria-hidden
        >
          {hint}
        </kbd>
      )}
    </button>
  );
}

function TimedSummaryCard({
  summary,
  onDismiss,
}: {
  summary: TimedSummary;
  onDismiss: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-warn/40 bg-[linear-gradient(160deg,rgb(251_191_36/0.16),var(--surface-0))] p-5 shadow-[0_24px_60px_-30px_rgb(251_191_36/0.7)] animate-pop-in">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-warn/15 blur-3xl" />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-warn/20 text-warn">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
              <path d="M5 4h14v3a5 5 0 01-3 4.58A4 4 0 0113 14.9V17h2.5a1 1 0 011 1v1.5h-9V18a1 1 0 011-1H11v-2.1a4 4 0 01-3-3.32A5 5 0 015 7V4z" />
            </svg>
          </span>
          <h3 className="text-lg font-extrabold text-white">Round Complete</h3>
        </div>
        <span className="rounded-full bg-warn/20 px-3 py-1 text-sm font-bold tabular-nums text-warn">
          {summary.accuracy}% acc
        </span>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <SummaryStat label="Score" value={String(summary.score)} large />
        <SummaryStat label="Accuracy" value={`${summary.accuracy}%`} />
        <SummaryStat label="Missed" value={String(summary.missedLetters.length)} />
        <SummaryStat
          label="Slowest"
          value={summary.slowestLetters[0] ? summary.slowestLetters[0].letter : "—"}
        />
      </div>

      {summary.missedLetters.length > 0 && (
        <div className="relative mt-4 rounded-2xl border border-warn/20 bg-surface-0/60 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
            Missed letters
          </p>
          <p className="mt-1.5 font-mono text-xl font-bold tracking-[0.3em] text-white">
            {summary.missedLetters.join(" ")}
          </p>
        </div>
      )}

      {summary.slowestLetters.length > 0 && (
        <div className="relative mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
            Slowest responses
          </p>
          <ul className="mt-2 space-y-1.5">
            {summary.slowestLetters.map(({ letter, avgMs }) => (
              <li
                key={letter}
                className="flex items-center justify-between rounded-lg border border-line bg-surface-0/50 px-3 py-1.5 text-sm text-muted"
              >
                <span className="font-mono font-bold text-white">{letter}</span>
                <span className="tabular-nums">{(avgMs / 1000).toFixed(1)}s avg</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="relative mt-4 rounded-xl border border-warn/20 bg-warn/5 p-3 text-sm leading-relaxed text-foreground/90">
        {summary.recommendation}
      </p>

      <button
        type="button"
        onClick={onDismiss}
        className="relative mt-4 min-h-11 w-full rounded-xl bg-gradient-to-r from-warn to-amber-400 px-4 py-3 text-sm font-bold text-surface-0 shadow-lg shadow-warn/20 transition-all hover:brightness-110 active:scale-[0.99]"
      >
        Continue <span className="opacity-70">(Esc)</span>
      </button>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  large,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-0/60 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
        {label}
      </div>
      <div className={`font-bold tabular-nums text-white ${large ? "text-2xl" : "text-lg"}`}>
        {value}
      </div>
    </div>
  );
}
