import { STICKERS, ALL_FACES } from "@/lib/stickers";
import type {
  Face,
  FaceStats,
  LetterStats,
  PersistedStats,
  SessionStats,
  TimedSummary,
} from "@/types/cube";

const STORAGE_KEY = "blind-cube-letter-trainer-stats";

function createEmptyLetterStats(): Record<string, LetterStats> {
  return Object.fromEntries(
    STICKERS.map((s) => [
      s.letter,
      { letter: s.letter, correct: 0, incorrect: 0, totalTimeMs: 0, attempts: 0 },
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
      session: { ...createEmptySession(), ...parsed.session },
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

export function recordLetterAttempt(
  stats: PersistedStats,
  letter: string,
  correct: boolean,
  timeMs: number,
): PersistedStats {
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
): LetterStats[] {
  return Object.values(stats.letters)
    .filter((l) => l.attempts > 0)
    .sort((a, b) => {
      const accA = a.correct / a.attempts;
      const accB = b.correct / b.attempts;
      if (accA !== accB) return accA - accB;
      return b.incorrect - a.incorrect;
    })
    .slice(0, limit);
}

export function buildTimedSummary(
  stats: PersistedStats,
  roundLetters: string[],
  roundTimes: Record<string, number[]>,
): TimedSummary {
  const score = stats.session.correct;
  const accuracy = getAccuracy(stats.session.correct, stats.session.incorrect);

  const missedLetters = Object.entries(stats.letters)
    .filter(([, l]) => l.incorrect > 0)
    .sort((a, b) => b[1].incorrect - a[1].incorrect)
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
  const recommendation =
    weakest.length > 0
      ? `Practice letters ${weakest.map((w) => w.letter).join(", ")} and drill the ${weakest[0].letter} sticker on the ${STICKERS.find((s) => s.letter === weakest[0].letter)?.face ?? "?"} face.`
      : "Great job! Try timed mode with corners-only to push your speed.";

  return { score, accuracy, missedLetters, slowestLetters, recommendation };
}
