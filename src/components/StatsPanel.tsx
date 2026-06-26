"use client";

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
  const sessionAccuracy = getAccuracy(
    stats.session.correct,
    stats.session.incorrect,
  );
  const roundAccuracy = getAccuracy(roundCorrect, roundIncorrect);
  const avgTime = getAverageResponseTime(stats);
  const weakest = getWeakestLetters(stats, 6);

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
          Weak Letters
        </h3>
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
    </div>
  );
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
