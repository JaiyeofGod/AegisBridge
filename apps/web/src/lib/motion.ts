/** CSS custom properties defined in src/styles/tokens.css. */
export const motionVars = {
  durationFast: "var(--motion-duration-fast)",
  durationStandard: "var(--motion-duration-standard)",
  durationCinematic: "var(--motion-duration-cinematic)",
  easeEnter: "var(--motion-ease-enter)",
  easeExit: "var(--motion-ease-exit)",
  distance: "var(--motion-distance)",
} as const;

/** Same duration the global reduced-motion rule forces in index.css. */
export const motionReducedDuration = "0.01ms";

export function motionDuration(duration: string, reducedMotion: boolean): string {
  return reducedMotion ? motionReducedDuration : duration;
}
