"use client";

import { useState } from "react";
import { ALL_FACES, FACE_COLORS, STICKERS } from "@/lib/stickers";
import {
  getAccuracy,
  getAverageResponseTime,
  getLetterAccuracy,
  getWeakestFaces,
  getWeakestLetters,
  needsPractice,
} from "@/lib/stats";
import type { Face, PersistedStats } from "@/types/cube";

type StatsScope = "all-time" | "session";

interface StatsPanelProps {
  stats: PersistedStats;
  roundCorrect: number;
  roundIncorrect: number;
  timerSeconds?: number | null;
  timedMode?: boolean;
  onPracticeWeakLetters?: (letters: string[]) => void;
}

export default function StatsPanel({
  stats,
  roundCorrect,
  roundIncorrect,
  timerSeconds,
  timedMode,
  onPracticeWeakLetters,
}: StatsPanelProps) {
  const [lettersExpanded, setLettersExpanded] = useState(false);
  const [scope, setScope] = useState<StatsScope>("all-time");

  const sessionAccuracy = getAccuracy(
    stats.session.correct,
    stats.session.incorrect,
  );
  const roundAccuracy = getAccuracy(roundCorrect, roundIncorrect);
  const avgTime = getAverageResponseTime(stats);
  const weakest = getWeakestLetters(stats, 6, scope);
  const weakestFaces = getWeakestFaces(stats, 3);
  const allTimeAccuracy = getAccuracy(
    Object.values(stats.letters).reduce((s, l) => s + l.correct, 0),
    Object.values(stats.letters).reduce((s, l) => s + l.incorrect, 0),
  );

  const faceAccuracies = ALL_FACES.map((face) => {
    const fs = stats.faces[face];
    return {
      face,
      accuracy: getAccuracy(fs.correct, fs.incorrect),
      attempts: fs.correct + fs.incorrect,
    };
  });

  const letterSource =
    scope === "session" ? stats.session.letters : stats.letters;

  const letterAccuracies = STICKERS.map((s) => {
    const ls = letterSource[s.letter];
    const attempts = ls?.attempts ?? 0;
    const accuracy = attempts > 0 ? getLetterAccuracy(ls!) : null;
    return {
      letter: s.letter,
      face: s.face,
      accuracy,
      attempts,
      needsPractice: ls ? needsPractice(ls) : false,
    };
  });

  const practiceLetters = weakest.map((w) => w.letter);

  return (
    <div className="scroll-slim max-h-[70vh] space-y-4 overflow-y-auto pr-1 lg:max-h-none lg:overflow-visible">
      {/* Scope toggle */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">
          Performance
        </h2>
        <div
          role="tablist"
          aria-label="Stats scope"
          className="inline-flex rounded-xl border border-line bg-surface-0/70 p-1"
        >
          {(["all-time", "session"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={scope === s}
              onClick={() => setScope(s)}
              className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                scope === s
                  ? "bg-brand/15 text-brand shadow-[0_0_0_1px_rgb(45_212_191/0.4)_inset]"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {s === "all-time" ? "All-time" : "Session"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <StatCard label="Streak" value={String(stats.session.currentStreak)} accent="brand" icon="flame" />
        <StatCard label="Best Streak" value={String(stats.session.bestStreak)} />
        <StatCard label="Session Acc." value={`${sessionAccuracy}%`} />
        <StatCard label="All-time Acc." value={`${allTimeAccuracy}%`} />
        <StatCard label="Round Acc." value={`${roundAccuracy}%`} />
        <StatCard label="Correct" value={String(stats.session.correct)} accent="green" />
        <StatCard label="Incorrect" value={String(stats.session.incorrect)} accent="red" />
        <StatCard label="Avg Response" value={`${(avgTime / 1000).toFixed(1)}s`} />
        {timedMode && (
          <StatCard
            label="Time Left"
            value={
              timerSeconds !== null && timerSeconds !== undefined
                ? `${timerSeconds}s`
                : "—"
            }
            accent="amber"
          />
        )}
      </div>

      {/* Face accuracy */}
      <div className="glass rounded-2xl p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-faint">
          Face Accuracy
        </h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {faceAccuracies.map(({ face, accuracy, attempts }) => (
            <div
              key={face}
              className="rounded-xl border border-line bg-surface-0/60 px-2 py-2.5 text-center"
            >
              <div
                className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg font-mono text-sm font-bold ring-1 ring-black/20"
                style={{
                  backgroundColor: FACE_COLORS[face],
                  color: LIGHT_FACES.includes(face) ? "#0b0f1a" : "#ffffff",
                }}
              >
                {face}
              </div>
              <div
                className={`mt-1.5 text-sm font-semibold ${accuracyColor(accuracy, attempts > 0)}`}
              >
                {attempts > 0 ? `${accuracy}%` : "—"}
              </div>
            </div>
          ))}
        </div>
        {weakestFaces.length > 0 && (
          <div className="mt-3 border-t border-line pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
              Weak faces (face drill)
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {weakestFaces.map(({ face, accuracy }) => (
                <li
                  key={face}
                  className="flex items-center gap-1.5 rounded-lg border border-bad/30 bg-bad/10 px-2 py-1 font-mono text-sm text-bad"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/20"
                    style={{ backgroundColor: FACE_COLORS[face] }}
                  />
                  {face} · {accuracy}%
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Letter accuracy */}
      <div className="glass rounded-2xl p-4">
        <button
          type="button"
          onClick={() => setLettersExpanded((v) => !v)}
          className="flex min-h-11 w-full items-center justify-between text-left"
        >
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
            {scope === "session" ? "Session Letter Accuracy" : "Letter Accuracy"}
          </h3>
          <span className="flex items-center gap-1 text-xs font-medium text-brand">
            {lettersExpanded ? "Collapse" : "Expand all 24"}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`h-3.5 w-3.5 transition-transform ${lettersExpanded ? "rotate-180" : ""}`}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </button>

        {lettersExpanded ? (
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {letterAccuracies.map(({ letter, face, accuracy, attempts, needsPractice: np }) => (
              <div
                key={letter}
                className="relative rounded-xl border border-line bg-surface-0/60 px-2 py-2 text-center"
                title={`${letter} on ${face} face`}
              >
                {np && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-warn text-[9px] font-bold text-surface-0">
                    !
                  </span>
                )}
                <div className="flex items-center justify-center gap-1">
                  <span
                    className="inline-block h-2 w-2 rounded-full ring-1 ring-black/20"
                    style={{ backgroundColor: FACE_COLORS[face] }}
                  />
                  <span className="font-mono text-base font-bold text-white">{letter}</span>
                </div>
                <div
                  className={`text-xs font-semibold ${accuracyColor(accuracy ?? 0, attempts > 0)}`}
                >
                  {attempts > 0 ? `${accuracy}%` : "—"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3">
            {weakest.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-surface-0/40 px-4 py-6 text-center">
                <p className="text-sm text-muted">
                  Play a few rounds to surface your weak spots.
                </p>
              </div>
            ) : (
              <>
                <ul className="space-y-2">
                  {weakest.map((w) => {
                    const acc = getLetterAccuracy(w);
                    const np = needsPractice(w);
                    const sticker = STICKERS.find((s) => s.letter === w.letter);
                    return (
                      <li
                        key={w.letter}
                        className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-0/60 px-3 py-2 text-sm"
                      >
                        <span className="flex items-center gap-2.5">
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-lg font-mono text-sm font-bold ring-1 ring-black/20"
                            style={{
                              backgroundColor: sticker ? FACE_COLORS[sticker.face] : "var(--surface-3)",
                              color:
                                sticker && LIGHT_FACES.includes(sticker.face)
                                  ? "#0b0f1a"
                                  : "#ffffff",
                            }}
                          >
                            {w.letter}
                          </span>
                          {np && (
                            <span className="rounded-md bg-warn/20 px-2 py-0.5 text-xs font-semibold text-warn">
                              needs practice
                            </span>
                          )}
                        </span>
                        <span className="text-muted">
                          <span className={accuracyColor(acc, true)}>{acc}%</span> ·{" "}
                          {w.incorrect} miss{w.incorrect === 1 ? "" : "es"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {onPracticeWeakLetters && practiceLetters.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onPracticeWeakLetters(practiceLetters)}
                    className="group mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand/40 bg-brand/10 px-4 py-2.5 text-sm font-semibold text-brand transition-all hover:bg-brand/20"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 transition-transform group-hover:rotate-12" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
                    </svg>
                    Drill weak letters ({practiceLetters.slice(0, 6).join(", ")})
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const LIGHT_FACES: Face[] = ["U", "D"];

function accuracyColor(accuracy: number, hasData: boolean): string {
  if (!hasData) return "text-faint";
  if (accuracy >= 90) return "text-good";
  if (accuracy >= 70) return "text-warn";
  return "text-bad";
}

function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: "brand" | "green" | "red" | "amber";
  icon?: "flame";
}) {
  const accentClass =
    accent === "brand"
      ? "text-brand"
      : accent === "green"
        ? "text-good"
        : accent === "red"
          ? "text-bad"
          : accent === "amber"
            ? "text-warn"
            : "text-white";

  return (
    <div className="group relative overflow-hidden rounded-xl border border-line bg-surface-1/60 p-3 transition-colors hover:border-line-strong">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
        {icon === "flame" && (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 text-brand" aria-hidden>
            <path d="M12 2c1 3-1.5 4.5-1.5 7A2.5 2.5 0 0013 11c0-1.5 1-2 1-2 2 2 3 4 3 6a5 5 0 11-10 0c0-3.5 3.5-5 5-13z" />
          </svg>
        )}
        {label}
      </div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${accentClass}`}>{value}</div>
    </div>
  );
}
