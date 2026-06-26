"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import ModeSelector from "@/components/ModeSelector";
import StatsPanel from "@/components/StatsPanel";
import FaceDrill from "@/components/FaceDrill";
import {
  filterStickers,
  pickRandomFace,
  pickRandomSticker,
} from "@/lib/stickers";
import {
  buildTimedSummary,
  getAccuracy,
  loadStats,
  recordFaceAttempt,
  recordLetterAttempt,
  resetStats,
  saveStats,
} from "@/lib/stats";
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
    <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl bg-slate-900 text-slate-400">
      Loading cube…
    </div>
  ),
});

const FEEDBACK_DELAY_MS = 1200;
const TIMED_DURATION_SEC = 60;

export default function CubeTrainer() {
  const [mode, setMode] = useState<TrainingMode>("find-letter");
  const [stats, setStats] = useState<PersistedStats | null>(null);
  const [filter, setFilter] = useState<StickerFilter>("all");
  const [showLetters, setShowLetters] = useState(false);
  const [timedMode, setTimedMode] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timedSummary, setTimedSummary] = useState<TimedSummary | null>(null);
  const [resetViewToken, setResetViewToken] = useState(0);

  const [roundCorrect, setRoundCorrect] = useState(0);
  const [roundIncorrect, setRoundIncorrect] = useState(0);
  const roundLettersRef = useRef<string[]>([]);
  const roundTimesRef = useRef<Record<string, number[]>>({});

  const [targetSticker, setTargetSticker] = useState<Sticker | null>(null);
  const [targetLetter, setTargetLetter] = useState<string>("");
  const [feedback, setFeedback] = useState<FeedbackState>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [highlights, setHighlights] = useState<StickerHighlight[]>([]);
  const [inputLocked, setInputLocked] = useState(false);

  const [letterInput, setLetterInput] = useState("");
  const promptStartRef = useRef<number>(Date.now());

  const [drillFace, setDrillFace] = useState<Face>("U");
  const [practiceAllFaces, setPracticeAllFaces] = useState(false);
  const [faceFeedback, setFaceFeedback] = useState<
    Record<StickerPosition, "idle" | "correct" | "incorrect"> | null
  >(null);

  const pool = filterStickers(filter);

  useEffect(() => {
    setStats(loadStats());
  }, []);

  const persistStats = useCallback((updated: PersistedStats) => {
    setStats(updated);
    saveStats(updated);
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
    const base = buildTimedSummary(
      stats,
      roundLettersRef.current,
      roundTimesRef.current,
    );
    const summary: TimedSummary = {
      ...base,
      score: roundCorrect,
      accuracy: getAccuracy(roundCorrect, roundIncorrect),
      missedLetters: roundLettersRef.current.filter((letter) => {
        const ls = stats.letters[letter];
        return ls && ls.incorrect > 0;
      }).slice(0, 8),
    };
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
  }, [mode, filter, practiceAllFaces, stats]); // eslint-disable-line react-hooks/exhaustive-deps

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
      else setRoundIncorrect((c) => c + 1);
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

      const correct = sticker.letter === targetLetter;
      recordAttempt(targetLetter, correct);

      if (correct) {
        setFeedback("correct");
        setFeedbackMessage(`Correct! ${targetLetter} is on ${sticker.face}`);
        setHighlights([
          { stickerId: sticker.id, variant: "correct" },
        ]);
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

    const correct = guess === targetLetter;
    recordAttempt(targetLetter, correct);

    if (correct) {
      setFeedback("correct");
      setFeedbackMessage(`Correct! That sticker is ${targetLetter}`);
      setHighlights([{ stickerId: targetSticker.id, variant: "correct" }]);
    } else {
      setFeedback("incorrect");
      setFeedbackMessage(`Wrong — the answer is ${targetLetter}`);
      setHighlights([
        { stickerId: targetSticker.id, variant: "hint" },
      ]);
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

      setInputLocked(true);
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

  const handleNewRound = () => {
    setRoundCorrect(0);
    setRoundIncorrect(0);
    roundLettersRef.current = [];
    roundTimesRef.current = {};
    setTimedSummary(null);
    setInputLocked(false);
    if (timedMode) {
      setTimerSeconds(TIMED_DURATION_SEC);
    } else {
      setTimerSeconds(null);
    }
    startNewPrompt();
  };

  const handleResetStats = () => {
    const fresh = resetStats();
    setStats(fresh);
    setRoundCorrect(0);
    setRoundIncorrect(0);
    roundLettersRef.current = [];
    roundTimesRef.current = {};
    setTimedSummary(null);
    startNewPrompt();
  };

  const handleModeChange = (m: TrainingMode) => {
    setMode(m);
    setTimedSummary(null);
    setRoundCorrect(0);
    setRoundIncorrect(0);
    roundLettersRef.current = [];
    roundTimesRef.current = {};
  };

  const focusFace = mode === "face-drill" ? drillFace : null;

  if (!stats) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading trainer…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                Blind Cube Letter Trainer
              </h1>
              <p className="text-sm text-slate-400">
                Speffz lettering for blindfolded 3×3 solving
              </p>
            </div>
            <ModeSelector mode={mode} onChange={handleModeChange} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <ControlButton onClick={handleNewRound}>New Round</ControlButton>
          <ControlButton onClick={() => setResetViewToken((t) => t + 1)}>
            Reset View
          </ControlButton>
          <ControlButton
            active={showLetters}
            onClick={() => setShowLetters((v) => !v)}
          >
            {showLetters ? "Hide Letters" : "Show Letters"}
          </ControlButton>
          <ControlButton
            active={timedMode}
            onClick={() => {
              const next = !timedMode;
              setTimedMode(next);
              setTimedSummary(null);
              if (next) {
                setTimerSeconds(TIMED_DURATION_SEC);
                setRoundCorrect(0);
                setRoundIncorrect(0);
                roundLettersRef.current = [];
                roundTimesRef.current = {};
              } else {
                setTimerSeconds(null);
              }
            }}
          >
            60s Timed Mode
          </ControlButton>
          <ControlButton variant="danger" onClick={handleResetStats}>
            Reset Stats
          </ControlButton>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-3">
            <div className="h-[360px] sm:h-[420px] lg:h-[480px]">
              <RubiksCube3D
                onStickerClick={handleStickerClick}
                highlights={highlights}
                showLetters={showLetters}
                focusFace={focusFace}
                disabled={inputLocked || mode === "face-drill"}
                resetViewToken={resetViewToken}
              />
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
              <FilterBar filter={filter} onChange={setFilter} />

              {mode === "face-drill" && (
                <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={practiceAllFaces}
                    onChange={(e) => setPracticeAllFaces(e.target.checked)}
                    className="rounded border-slate-600"
                  />
                  Practice all faces (random order)
                </label>
              )}

              <div
                className={`mt-5 rounded-xl border p-4 transition-all ${
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
                      className="mt-3 w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-3xl font-bold uppercase text-white outline-none focus:border-cyan-400"
                      autoFocus
                    />
                    <button
                      type="button"
                      disabled={inputLocked || !letterInput}
                      onClick={handleLetterSubmit}
                      className="mt-3 w-full rounded-xl bg-cyan-500 py-2 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
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
              <TimedSummaryCard summary={timedSummary} onDismiss={() => setTimedSummary(null)} />
            )}

            <StatsPanel
              stats={stats}
              roundCorrect={roundCorrect}
              roundIncorrect={roundIncorrect}
              timerSeconds={timerSeconds}
              timedMode={timedMode}
            />
          </section>
        </div>
      </main>
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
    <div className="flex flex-wrap gap-2">
      <span className="text-xs uppercase tracking-wide text-slate-500">Filter</span>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-lg px-3 py-1 text-sm ${
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
    "rounded-lg border px-3 py-2 text-sm font-medium transition";
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
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
      <h3 className="text-lg font-bold text-amber-200">Timed Round Complete</h3>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>Score: <span className="font-bold text-white">{summary.score}</span></div>
        <div>Accuracy: <span className="font-bold text-white">{summary.accuracy}%</span></div>
      </div>
      {summary.missedLetters.length > 0 && (
        <p className="mt-3 text-sm text-slate-300">
          Missed letters:{" "}
          <span className="font-mono font-bold">{summary.missedLetters.join(" ")}</span>
        </p>
      )}
      {summary.slowestLetters.length > 0 && (
        <p className="mt-2 text-sm text-slate-300">
          Slowest:{" "}
          {summary.slowestLetters
            .map((s) => `${s.letter} (${(s.avgMs / 1000).toFixed(1)}s)`)
            .join(", ")}
        </p>
      )}
      <p className="mt-3 text-sm text-amber-100/90">{summary.recommendation}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
      >
        Continue
      </button>
    </div>
  );
}
