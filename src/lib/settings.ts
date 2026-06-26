export type LetterDisplayMode = "learning" | "test";

export interface TrainerSettings {
  letterDisplay: LetterDisplayMode;
}

const STORAGE_KEY = "blind-cube-letter-trainer-settings";

export function createDefaultSettings(): TrainerSettings {
  return { letterDisplay: "test" };
}

export function loadSettings(): TrainerSettings {
  if (typeof window === "undefined") return createDefaultSettings();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultSettings();
    const parsed = JSON.parse(raw) as Partial<TrainerSettings>;
    if (parsed.letterDisplay === "learning" || parsed.letterDisplay === "test") {
      return { letterDisplay: parsed.letterDisplay };
    }
    return createDefaultSettings();
  } catch {
    return createDefaultSettings();
  }
}

export function saveSettings(settings: TrainerSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function settingsShowLetters(settings: TrainerSettings): boolean {
  return settings.letterDisplay === "learning";
}
