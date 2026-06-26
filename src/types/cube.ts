export type Face = "U" | "D" | "F" | "B" | "R" | "L";

export type StickerPosition =
  | "top-left"
  | "top-right"
  | "bottom-right"
  | "bottom-left";

export type PieceType = "edge" | "corner";

export type TrainingMode = "find-letter" | "name-sticker" | "face-drill";

export type StickerFilter = "all" | "edges" | "corners";

export interface StickerCoordinates {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
  z: -1 | 0 | 1;
}

export interface Sticker {
  id: string;
  letter: string;
  face: Face;
  type: PieceType;
  position: StickerPosition;
  coordinates: StickerCoordinates;
}

export type FeedbackState = "idle" | "correct" | "incorrect";

export interface LetterStats {
  letter: string;
  correct: number;
  incorrect: number;
  totalTimeMs: number;
  attempts: number;
  lastAttemptAt?: string;
}

export interface SessionLetterStats {
  letter: string;
  correct: number;
  incorrect: number;
  attempts: number;
  lastAttemptAt?: string;
}

export interface FaceStats {
  face: Face;
  correct: number;
  incorrect: number;
}

export interface SessionStats {
  currentStreak: number;
  bestStreak: number;
  correct: number;
  incorrect: number;
  totalTimeMs: number;
  timedRounds: number;
  letters: Record<string, SessionLetterStats>;
}

export interface PersistedStats {
  letters: Record<string, LetterStats>;
  faces: Record<Face, FaceStats>;
  session: SessionStats;
  lastUpdated: string;
}

export interface TimedSummary {
  score: number;
  accuracy: number;
  missedLetters: string[];
  slowestLetters: { letter: string; avgMs: number }[];
  recommendation: string;
}

export interface StickerHighlight {
  stickerId: string;
  variant: "prompt" | "correct" | "incorrect" | "hint";
}
