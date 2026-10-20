import { SignInSceneFallback } from "@/features/signin/SignInSceneFallback";
import { SignInSplineScene } from "@/features/signin/SignInSplineScene";
import { useMediaQuery, usePrefersReducedMotion } from "@/hooks/useMediaQuery";

/**
 * Left brand panel for Sign-in.
 * Scene fills the full panel; copy sits above it. Live Spline loads on large
 * viewports without reduced motion; static fallback otherwise.
 */
export function SignInVisual() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isCompactViewport = useMediaQuery("(max-width: 1023px)");
  const useLiveScene = !prefersReducedMotion && !isCompactViewport;

  return (
    <div
      className="relative h-full min-h-[320px] overflow-hidden bg-[radial-gradient(120%_80%_at_20%_10%,#1b3344_0%,#0c1118_55%,#082126_100%)] lg:min-h-screen"
      data-testid="signin-visual"
      data-visual-mode={useLiveScene ? "spline-live" : "static-fallback"}
    >
      <div className="absolute inset-0" aria-hidden>
        {useLiveScene ? <SignInSplineScene /> : <SignInSceneFallback />}
      </div>

      <div className="relative z-10 max-w-xl p-8 md:p-12">
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
    </div>
  );
}
