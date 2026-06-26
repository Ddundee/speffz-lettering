import { STICKERS, ALL_FACES } from "@/lib/stickers";
import type {
  Face,
  FaceStats,
  LetterStats,
  PersistedStats,
  SessionLetterStats,
  SessionStats,
  TimedSummary,
} from "@/types/cube";

const STORAGE_KEY = "blind-cube-letter-trainer-stats";

export const NEEDS_PRACTICE_ACCURACY = 70;
export const NEEDS_PRACTICE_MIN_ATTEMPTS = 3;

function createEmptyLetterStats(): Record<string, LetterStats> {
  return Object.fromEntries(
    STICKERS.map((s) => [
      s.letter,
      { letter: s.letter, correct: 0, incorrect: 0, totalTimeMs: 0, attempts: 0 },
    ]),
  );
}

function createEmptySessionLetters(): Record<string, SessionLetterStats> {
  return Object.fromEntries(
    STICKERS.map((s) => [
      s.letter,
      { letter: s.letter, correct: 0, incorrect: 0, attempts: 0 },
    ]),
  );
}

function createEmptyFaceStats(): Record<Face, FaceStats> {
  return Object.fromEntries(
    ALL_FACES.map((face) => [face, { face, correct: 0, incorrect: 0 }]),
  ) as Record<Face, FaceStats>;
}

function createEmptySession(): SessionStats {
  return {
    currentStreak: 0,
    bestStreak: 0,
    correct: 0,
    incorrect: 0,
    totalTimeMs: 0,
    timedRounds: 0,
    letters: createEmptySessionLetters(),
  };
}

export function createDefaultStats(): PersistedStats {
  return {
    letters: createEmptyLetterStats(),
    faces: createEmptyFaceStats(),
    session: createEmptySession(),
    lastUpdated: new Date().toISOString(),
  };
}

export function loadStats(): PersistedStats {
  if (typeof window === "undefined") return createDefaultStats();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultStats();
    const parsed = JSON.parse(raw) as PersistedStats;
    return {
      ...createDefaultStats(),
      ...parsed,
      letters: { ...createEmptyLetterStats(), ...parsed.letters },
      faces: { ...createEmptyFaceStats(), ...parsed.faces },
      session: {
        ...createEmptySession(),
        ...parsed.session,
        letters: {
          ...createEmptySessionLetters(),
          ...parsed.session?.letters,
        },
      },
    };
  } catch {
    return createDefaultStats();
  }
}

export function saveStats(stats: PersistedStats): void {
  if (typeof window === "undefined") return;
  const payload = { ...stats, lastUpdated: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function resetStats(): PersistedStats {
  const fresh = createDefaultStats();
  saveStats(fresh);
  return fresh;
}

function updateSessionLetter(
  sessionLetters: Record<string, SessionLetterStats>,
  letter: string,
  correct: boolean,
): Record<string, SessionLetterStats> {
  const existing = sessionLetters[letter] ?? {
    letter,
    correct: 0,
    incorrect: 0,
    attempts: 0,
  };
  return {
    ...sessionLetters,
    [letter]: {
      ...existing,
      correct: existing.correct + (correct ? 1 : 0),
      incorrect: existing.incorrect + (correct ? 0 : 1),
      attempts: existing.attempts + 1,
      lastAttemptAt: new Date().toISOString(),
    },
  };
}

export function recordLetterAttempt(
  stats: PersistedStats,
  letter: string,
  correct: boolean,
  timeMs: number,
): PersistedStats {
  const now = new Date().toISOString();
  const letterStats = stats.letters[letter] ?? {
    letter,
    correct: 0,
    incorrect: 0,
    totalTimeMs: 0,
    attempts: 0,
  };

  const updatedLetters = {
    ...stats.letters,
    [letter]: {
      ...letterStats,
      correct: letterStats.correct + (correct ? 1 : 0),
      incorrect: letterStats.incorrect + (correct ? 0 : 1),
      totalTimeMs: letterStats.totalTimeMs + timeMs,
      attempts: letterStats.attempts + 1,
      lastAttemptAt: now,
    },
  };

  const session = { ...stats.session };
  if (correct) {
    session.correct += 1;
    session.currentStreak += 1;
    session.bestStreak = Math.max(session.bestStreak, session.currentStreak);
  } else {
    session.incorrect += 1;
    session.currentStreak = 0;
  }
  session.totalTimeMs += timeMs;
  session.letters = updateSessionLetter(session.letters, letter, correct);

  return { ...stats, letters: updatedLetters, session };
}

export function recordFaceAttempt(
  stats: PersistedStats,
  face: Face,
  correctCount: number,
  incorrectCount: number,
): PersistedStats {
  const faceStats = stats.faces[face];
  const updatedFaces = {
    ...stats.faces,
    [face]: {
      ...faceStats,
      correct: faceStats.correct + correctCount,
      incorrect: faceStats.incorrect + incorrectCount,
    },
  };

  const session = { ...stats.session };
  const allCorrect = incorrectCount === 0 && correctCount > 0;
  if (allCorrect) {
    session.correct += 1;
    session.currentStreak += 1;
    session.bestStreak = Math.max(session.bestStreak, session.currentStreak);
  } else if (incorrectCount > 0) {
    session.incorrect += 1;
    session.currentStreak = 0;
  }

  return { ...stats, faces: updatedFaces, session };
}

export function getAccuracy(correct: number, incorrect: number): number {
  const total = correct + incorrect;
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

export function getLetterAccuracy(stats: LetterStats | SessionLetterStats): number {
  if (stats.attempts === 0) return 0;
  return Math.round((stats.correct / stats.attempts) * 100);
}

export function needsPractice(
  stats: LetterStats | SessionLetterStats,
): boolean {
  return (
    stats.attempts >= NEEDS_PRACTICE_MIN_ATTEMPTS &&
    getLetterAccuracy(stats) < NEEDS_PRACTICE_ACCURACY
  );
}

function weakLetterScore(
  stats: LetterStats | SessionLetterStats,
  nowMs: number,
): number {
  if (stats.attempts === 0) return -1;
  const accuracy = stats.correct / stats.attempts;
  const errorRate = stats.incorrect / stats.attempts;
  let recencyBoost = 0;
  if (stats.lastAttemptAt) {
    const hoursSince =
      (nowMs - new Date(stats.lastAttemptAt).getTime()) / (1000 * 60 * 60);
    recencyBoost = Math.max(0, 1 - hoursSince / 168) * 0.35;
  }
  return (1 - accuracy) * 100 + errorRate * 20 + recencyBoost * 30;
}

export function getAverageResponseTime(stats: PersistedStats): number {
  const attempts = Object.values(stats.letters).reduce(
    (sum, l) => sum + l.attempts,
    0,
  );
  if (attempts === 0) return 0;
  const totalMs = Object.values(stats.letters).reduce(
    (sum, l) => sum + l.totalTimeMs,
    0,
  );
  return Math.round(totalMs / attempts);
}

export function getWeakestLetters(
  stats: PersistedStats,
  limit = 5,
  scope: "all-time" | "session" = "all-time",
): (LetterStats | SessionLetterStats)[] {
  const nowMs = Date.now();
  const source =
    scope === "session"
      ? Object.values(stats.session.letters)
      : Object.values(stats.letters);

  return source
    .filter((l) => l.attempts > 0)
    .sort((a, b) => weakLetterScore(b, nowMs) - weakLetterScore(a, nowMs))
    .slice(0, limit);
}

export function getWeakestFaces(
  stats: PersistedStats,
  limit = 3,
): { face: Face; accuracy: number; attempts: number }[] {
  return ALL_FACES.map((face) => {
    const fs = stats.faces[face];
    const attempts = fs.correct + fs.incorrect;
    return {
      face,
      accuracy: getAccuracy(fs.correct, fs.incorrect),
      attempts,
    };
  })
    .filter((f) => f.attempts > 0)
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)
    .slice(0, limit);
}

export function buildTimedSummary(
  stats: PersistedStats,
  roundLetters: string[],
  roundTimes: Record<string, number[]>,
  roundCorrect: number,
  roundIncorrect: number,
  roundMissedCounts: Record<string, number>,
): TimedSummary {
  const score = roundCorrect;
  const accuracy = getAccuracy(roundCorrect, roundIncorrect);

  const missedLetters = Object.entries(roundMissedCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([letter]) => letter)
    .slice(0, 8);

  const slowestLetters = roundLetters
    .map((letter) => {
      const times = roundTimes[letter] ?? [];
      const avgMs =
        times.length > 0
          ? times.reduce((a, b) => a + b, 0) / times.length
          : 0;
      return { letter, avgMs };
    })
    .filter((e) => e.avgMs > 0)
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, 5);

  const weakest = getWeakestLetters(stats, 3);
  const weakestFaces = getWeakestFaces(stats, 2);
  const faceHint =
    weakestFaces.length > 0
      ? ` Drill the ${weakestFaces.map((f) => f.face).join(" and ")} face${weakestFaces.length > 1 ? "s" : ""}.`
      : "";
  const recommendation =
    weakest.length > 0
      ? `Practice letters ${weakest.map((w) => w.letter).join(", ")} — focus on ${weakest[0].letter} on the ${STICKERS.find((s) => s.letter === weakest[0].letter)?.face ?? "?"} face.${faceHint}`
      : "Great job! Try timed mode with corners-only to push your speed.";

  return { score, accuracy, missedLetters, slowestLetters, recommendation };
}
