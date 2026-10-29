export const MOTION_PREFERENCE_KEY = "aegisbridge.motion.v1";

export const motionPreferenceValues = ["system", "reduce"] as const;

export type MotionPreference = (typeof motionPreferenceValues)[number];

/** Unknown or unreadable values follow the operating system. */
export function readMotionPreference(raw: string | null | undefined): MotionPreference {
  return raw === "reduce" ? "reduce" : "system";
}

/** Operating-system reduced motion always wins over Follow system setting. */
export function prefersReducedMotion(preference: MotionPreference, osReduced: boolean): boolean {
  return osReduced || preference === "reduce";
}

function preferenceStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function getMotionPreference(): MotionPreference {
  try {
    return readMotionPreference(preferenceStorage()?.getItem(MOTION_PREFERENCE_KEY));
  } catch {
    return "system";
  }
}

const listeners = new Set<() => void>();

export function subscribeMotionPreference(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function operatingSystemReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function setMotionPreference(next: MotionPreference): void {
  try {
    preferenceStorage()?.setItem(MOTION_PREFERENCE_KEY, next);
  } catch {
    // Private mode or a full store still updates open views below.
  }
  applyMotionDocumentState(next, operatingSystemReducedMotion());
  listeners.forEach((listener) => listener());
}

export function applyMotionDocumentState(preference: MotionPreference, osReduced: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.motion = prefersReducedMotion(preference, osReduced)
    ? "reduce"
    : "system";
}
