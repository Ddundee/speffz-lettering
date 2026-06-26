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
    <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl bg-slate-900 text-slate-400 sm:min-h-[320px]">
      Loading cube…
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading trainer…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  Blind Cube Letter Trainer
                </h1>
                <p className="text-sm text-slate-400">
                  Speffz lettering for blindfolded 3×3 solving
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:text-white lg:hidden"
                aria-label="Open settings"
              >
                <GearIcon />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ModeSelector mode={mode} onChange={handleModeChange} />
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="hidden h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-slate-300 hover:border-slate-600 hover:text-white lg:flex"
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
          <ControlButton onClick={handleNewRound}>New Round (N)</ControlButton>
          <ControlButton onClick={() => setResetViewToken((t) => t + 1)}>
            Reset View (R)
          </ControlButton>
          <ControlButton active={effectiveShowLetters} onClick={handleToggleLetters}>
            {effectiveShowLetters ? "Hide Letters (L)" : "Show Letters (L)"}
            {lettersOverridden && (
              <span className="ml-1 text-xs opacity-70">session</span>
            )}
          </ControlButton>
          <ControlButton active={timedMode} onClick={handleToggleTimedMode}>
            60s Timed (T)
          </ControlButton>
          <ControlButton variant="danger" onClick={handleResetStats}>
            Reset Stats
          </ControlButton>
          <ControlButton onClick={() => setShortcutsOpen((v) => !v)}>
            Shortcuts (?)
          </ControlButton>
        </div>

        {weakLetterFilter && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            <span>
              Practicing weak letters:{" "}
              <span className="font-mono font-bold">{weakLetterFilter.join(" ")}</span>
            </span>
            <button
              type="button"
              onClick={() => setWeakLetterFilter(null)}
              className="min-h-11 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white"
            >
              Clear filter
            </button>
          </div>
        )}

        {shortcutsOpen && <ShortcutLegend onClose={() => setShortcutsOpen(false)} />}

        <div className="grid flex-1 gap-4 sm:gap-6 lg:grid-cols-2">
          <section className="order-1 min-h-0 space-y-3">
            <div className="h-[280px] sm:h-[360px] md:h-[420px] lg:h-[480px]">
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
            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 sm:p-5">
              {mode !== "face-drill" && (
                <FilterBar filter={filter} onChange={setFilter} />
              )}

              {mode === "face-drill" && (
                <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={practiceAllFaces}
                    onChange={(e) => setPracticeAllFaces(e.target.checked)}
                    className="h-5 w-5 rounded border-slate-600"
                  />
                  Practice all faces (random order)
                </label>
              )}

              <div
                className={`mt-4 rounded-xl border p-4 transition-all sm:mt-5 ${
                  feedback === "correct"
                    ? "border-emerald-500/50 bg-emerald-500/10 animate-pulse-once"
                    : feedback === "incorrect"
                      ? "border-rose-500/50 bg-rose-500/10 animate-shake"
                      : "border-slate-700 bg-slate-800/40"
                }`}
              >
                {mode === "find-letter" && (
                  <div>
                    <p className="text-sm text-slate-400">Find the letter</p>
                    <p className="mt-1 text-4xl font-bold text-cyan-300">
                      {targetLetter || "—"}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Click the matching sticker on the cube
                    </p>
                  </div>
                )}

                {mode === "name-sticker" && (
                  <div>
                    <p className="text-sm text-slate-400">Name the highlighted sticker</p>
                    <input
                      ref={letterInputRef}
                      type="text"
                      value={letterInput}
                      disabled={inputLocked}
                      maxLength={1}
                      placeholder="Type letter…"
                      onChange={(e) =>
                        setLetterInput(e.target.value.slice(-1).toUpperCase())
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleLetterSubmit();
                      }}
                      className="mt-3 min-h-11 w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-3xl font-bold uppercase text-white outline-none focus:border-cyan-400"
                      autoFocus
                    />
                    <button
                      type="button"
                      disabled={inputLocked || !letterInput}
                      onClick={handleLetterSubmit}
                      className="mt-3 min-h-11 w-full rounded-xl bg-cyan-500 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
                    >
                      Submit (Enter)
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
                    className={`mt-4 text-sm font-medium ${
                      feedback === "correct" ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
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

      <footer className="border-t border-slate-800 bg-slate-900/50 px-4 py-2 text-center text-xs text-slate-500 sm:px-6">
        <button
          type="button"
          onClick={() => setShortcutsOpen((v) => !v)}
          className="min-h-11 px-2 hover:text-slate-300"
        >
          Press <kbd className="rounded bg-slate-800 px-1">?</kbd> for keyboard shortcuts
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
    <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Keyboard shortcuts
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-lg px-3 text-xs text-slate-500 hover:text-white"
        >
          Close
        </button>
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">
        {shortcuts.map(([key, desc]) => (
          <div key={key} className="flex items-center gap-3 text-sm">
            <kbd className="min-w-[4rem] rounded bg-slate-800 px-2 py-1 text-center font-mono text-xs text-cyan-200">
              {key}
            </kbd>
            <span className="text-slate-400">{desc}</span>
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
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-full text-xs uppercase tracking-wide text-slate-500 sm:w-auto">
        Filter
      </span>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`min-h-11 rounded-lg px-4 py-2 text-sm ${
            filter === o.id
              ? "bg-cyan-500/20 text-cyan-200"
              : "bg-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ControlButton({
  children,
  onClick,
  active,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  variant?: "danger";
}) {
  const base =
    "min-h-11 rounded-lg border px-3 py-2 text-sm font-medium transition";
  const classes =
    variant === "danger"
      ? `${base} border-rose-800 bg-rose-950/50 text-rose-200 hover:bg-rose-900/50`
      : active
        ? `${base} border-cyan-500/50 bg-cyan-500/15 text-cyan-100`
        : `${base} border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:text-white`;

  return (
    <button type="button" onClick={onClick} className={classes}>
      {children}
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
    <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 to-slate-900/80 p-5 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold text-amber-100">Timed Round Complete</h3>
        <span className="rounded-full bg-amber-500/20 px-3 py-1 text-sm font-bold text-amber-200">
          {summary.accuracy}% acc
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Score" value={String(summary.score)} large />
        <SummaryStat label="Accuracy" value={`${summary.accuracy}%`} />
        <SummaryStat
          label="Missed"
          value={String(summary.missedLetters.length)}
        />
        <SummaryStat
          label="Slowest"
          value={
            summary.slowestLetters[0]
              ? summary.slowestLetters[0].letter
              : "—"
          }
        />
      </div>

      {summary.missedLetters.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-slate-900/50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Missed letters</p>
          <p className="mt-1 font-mono text-xl font-bold tracking-widest text-white">
            {summary.missedLetters.join(" ")}
          </p>
        </div>
      )}

      {summary.slowestLetters.length > 0 && (
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Slowest responses</p>
          <ul className="mt-2 space-y-1">
            {summary.slowestLetters.map(({ letter, avgMs }) => (
              <li
                key={letter}
                className="flex justify-between text-sm text-slate-300"
              >
                <span className="font-mono font-bold text-white">{letter}</span>
                <span>{(avgMs / 1000).toFixed(1)}s avg</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm leading-relaxed text-amber-50/90">
        {summary.recommendation}
      </p>

      <button
        type="button"
        onClick={onDismiss}
        className="mt-4 min-h-11 w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400"
      >
        Continue (Esc)
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
    <div className="rounded-lg bg-slate-900/60 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`font-bold text-white ${large ? "text-2xl" : "text-lg"}`}>
        {value}
      </div>
    </div>
  );
}
