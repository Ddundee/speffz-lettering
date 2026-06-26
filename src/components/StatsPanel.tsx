"use client";

import { useState } from "react";
import { ALL_FACES, STICKERS } from "@/lib/stickers";
import { getAccuracy, getAverageResponseTime, getWeakestLetters } from "@/lib/stats";
import type { PersistedStats } from "@/types/cube";

interface StatsPanelProps {
  stats: PersistedStats;
  roundCorrect: number;
  roundIncorrect: number;
  timerSeconds?: number | null;
  timedMode?: boolean;
}

export default function StatsPanel({
  stats,
  roundCorrect,
  roundIncorrect,
  timerSeconds,
  timedMode,
}: StatsPanelProps) {
  const [lettersExpanded, setLettersExpanded] = useState(false);

  const sessionAccuracy = getAccuracy(
    stats.session.correct,
    stats.session.incorrect,
  );
  const roundAccuracy = getAccuracy(roundCorrect, roundIncorrect);
  const avgTime = getAverageResponseTime(stats);
  const weakest = getWeakestLetters(stats, 6);

  const faceAccuracies = ALL_FACES.map((face) => {
    const fs = stats.faces[face];
    return {
      face,
      accuracy: getAccuracy(fs.correct, fs.incorrect),
      attempts: fs.correct + fs.incorrect,
    };
  });

  const letterAccuracies = STICKERS.map((s) => {
    const ls = stats.letters[s.letter];
    const attempts = ls?.attempts ?? 0;
    const accuracy =
      attempts > 0 ? Math.round(((ls?.correct ?? 0) / attempts) * 100) : null;
    return { letter: s.letter, face: s.face, accuracy, attempts };
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Streak" value={String(stats.session.currentStreak)} accent="cyan" />
        <StatCard label="Best Streak" value={String(stats.session.bestStreak)} />
        <StatCard label="Session Acc." value={`${sessionAccuracy}%`} />
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
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
        <button
          type="button"
          onClick={() => setLettersExpanded((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Letter Accuracy
          </h3>
          <span className="text-xs text-slate-500">
            {lettersExpanded ? "Collapse" : "Expand all 24"}
          </span>
        </button>

        {lettersExpanded ? (
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {letterAccuracies.map(({ letter, face, accuracy, attempts }) => (
              <div
                key={letter}
                className="rounded-lg bg-slate-800/80 px-2 py-2 text-center"
                title={`${letter} on ${face} face`}
              >
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
              <ul className="space-y-2">
                {weakest.map((w) => {
                  const acc =
                    w.attempts > 0
                      ? Math.round((w.correct / w.attempts) * 100)
                      : 0;
                  return (
                    <li
                      key={w.letter}
                      className="flex items-center justify-between rounded-lg bg-slate-800/80 px-3 py-2 text-sm"
                    >
                      <span className="font-mono text-lg font-bold text-white">{w.letter}</span>
                      <span className="text-slate-400">
                        {acc}% · {w.incorrect} miss{w.incorrect === 1 ? "" : "es"}
                      </span>
                    </li>
                  );
                })}
              </ul>
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
