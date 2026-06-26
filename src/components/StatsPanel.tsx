"use client";

import { useState } from "react";
import { ALL_FACES, STICKERS } from "@/lib/stickers";
import {
  getAccuracy,
  getAverageResponseTime,
  getLetterAccuracy,
  getWeakestFaces,
  getWeakestLetters,
  needsPractice,
} from "@/lib/stats";
import type { PersistedStats } from "@/types/cube";

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
    <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1 lg:max-h-none lg:overflow-visible">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-slate-500">
          Stats scope
        </span>
        {(["all-time", "session"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScope(s)}
            className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium ${
              scope === s
                ? "bg-cyan-500/20 text-cyan-200"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {s === "all-time" ? "All-time" : "Session"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Streak" value={String(stats.session.currentStreak)} accent="cyan" />
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
            value={timerSeconds !== null && timerSeconds !== undefined ? `${timerSeconds}s` : "—"}
            accent="amber"
          />
        )}
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Face Accuracy
        </h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {faceAccuracies.map(({ face, accuracy, attempts }) => (
            <div
              key={face}
              className="rounded-lg bg-slate-800/80 px-2 py-2 text-center"
            >
              <div className="font-mono text-lg font-bold text-white">{face}</div>
              <div
                className={`text-sm font-semibold ${accuracyColor(accuracy, attempts > 0)}`}
              >
                {attempts > 0 ? `${accuracy}%` : "—"}
              </div>
            </div>
          ))}
        </div>
        {weakestFaces.length > 0 && (
          <div className="mt-3 border-t border-slate-700/80 pt-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Weak faces (face drill)
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {weakestFaces.map(({ face, accuracy }) => (
                <li
                  key={face}
                  className="rounded-lg bg-rose-950/40 px-2 py-1 text-sm font-mono text-rose-200"
                >
                  {face} · {accuracy}%
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
        <button
          type="button"
          onClick={() => setLettersExpanded((v) => !v)}
          className="flex min-h-11 w-full items-center justify-between text-left"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {scope === "session" ? "Session Letter Accuracy" : "Letter Accuracy"}
          </h3>
          <span className="text-xs text-slate-500">
            {lettersExpanded ? "Collapse" : "Expand all 24"}
          </span>
        </button>

        {lettersExpanded ? (
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {letterAccuracies.map(({ letter, face, accuracy, attempts, needsPractice: np }) => (
              <div
                key={letter}
                className="relative rounded-lg bg-slate-800/80 px-2 py-2 text-center"
                title={`${letter} on ${face} face`}
              >
                {np && (
                  <span className="absolute -right-1 -top-1 rounded bg-amber-500 px-1 text-[9px] font-bold text-slate-950">
                    !
                  </span>
                )}
                <div className="font-mono text-base font-bold text-white">{letter}</div>
                <div className="text-[10px] text-slate-500">{face}</div>
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
              <p className="text-sm text-slate-500">Play a few rounds to see weak spots.</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {weakest.map((w) => {
                    const acc = getLetterAccuracy(w);
                    const np = needsPractice(w);
                    return (
                      <li
                        key={w.letter}
                        className="flex items-center justify-between gap-2 rounded-lg bg-slate-800/80 px-3 py-2 text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-lg font-bold text-white">
                            {w.letter}
                          </span>
                          {np && (
                            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-200">
                              needs practice
                            </span>
                          )}
                        </span>
                        <span className="text-slate-400">
                          {acc}% · {w.incorrect} miss{w.incorrect === 1 ? "" : "es"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {onPracticeWeakLetters && practiceLetters.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onPracticeWeakLetters(practiceLetters)}
                    className="mt-3 min-h-11 w-full rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/20"
                  >
                    Practice weak letters ({practiceLetters.slice(0, 6).join(", ")})
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

function accuracyColor(accuracy: number, hasData: boolean): string {
  if (!hasData) return "text-slate-500";
  if (accuracy >= 90) return "text-emerald-300";
  if (accuracy >= 70) return "text-amber-300";
  return "text-rose-300";
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "cyan" | "green" | "red" | "amber";
}) {
  const accentClass =
    accent === "cyan"
      ? "text-cyan-300"
      : accent === "green"
        ? "text-emerald-300"
        : accent === "red"
          ? "text-rose-300"
          : accent === "amber"
            ? "text-amber-300"
            : "text-white";

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${accentClass}`}>{value}</div>
    </div>
  );
}
