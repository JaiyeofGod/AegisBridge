import { SignInSceneFallback } from "@/features/signin/SignInSceneFallback";
import { SignInSplineScene } from "@/features/signin/SignInSplineScene";
import { useMediaQuery, usePrefersReducedMotion } from "@/hooks/useMediaQuery";

/**
 * Left brand panel for Sign-in.
 * Live Spline scene loads lazily on large viewports without reduced motion;
 * static fallback otherwise. Form column is unaffected.
 */
export function SignInVisual() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isCompactViewport = useMediaQuery("(max-width: 1023px)");
  const useLiveScene = !prefersReducedMotion && !isCompactViewport;

  return (
    <div
      className="relative flex h-full min-h-[320px] flex-col overflow-hidden bg-[radial-gradient(120%_80%_at_20%_10%,#1b3344_0%,#0c1118_55%,#082126_100%)] p-8 md:p-12"
      data-testid="signin-visual"
      data-visual-mode={useLiveScene ? "spline-live" : "static-fallback"}
    >
      <div className="relative z-10 max-w-xl shrink-0">
        <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent)] uppercase">
          AegisBridge
        </p>
        <h1 className="font-heading mt-4 text-4xl leading-tight font-extrabold text-balance text-[var(--text)] md:text-5xl">
          See the threat.
          <br />
          Bridge the response.
        </h1>
        <p className="mt-4 max-w-md text-base text-[var(--muted)]">
          Connect your assets, investigations, risks, and controls in one clear operational view.
        </p>
      </div>

      <div className="relative z-10 -mx-2 mt-6 min-h-[280px] flex-1 md:-mx-4 md:mt-8 md:min-h-[360px]">
        {useLiveScene ? <SignInSplineScene /> : <SignInSceneFallback />}
      </div>
    </div>
  );
}
