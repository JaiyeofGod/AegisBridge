import { useEffect, useState, useSyncExternalStore } from "react";

import {
  applyMotionDocumentState,
  getMotionPreference,
  prefersReducedMotion,
  subscribeMotionPreference,
} from "@/lib/motion-preference";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export function usePrefersReducedMotion(): boolean {
  const osReduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const preference = useSyncExternalStore(
    subscribeMotionPreference,
    getMotionPreference,
    () => "system" as const,
  );

  useEffect(() => {
    applyMotionDocumentState(preference, osReduced);
  }, [preference, osReduced]);

  return prefersReducedMotion(preference, osReduced);
}
