import { useEffect, useRef } from "react";

import { artworkParallax, artworkParallaxRest } from "@/features/signin/artwork-parallax";
import { SignInSceneFallback } from "@/features/signin/SignInSceneFallback";
import { SignInSplineScene } from "@/features/signin/SignInSplineScene";
import { useMediaQuery, usePrefersReducedMotion } from "@/hooks/useMediaQuery";

export const signInCanvasBackground =
  "bg-[radial-gradient(120%_80%_at_20%_10%,#1b3344_0%,#0c1118_55%,#082126_100%)]";

/**
 * Left brand panel for Sign-in.
 * Padded hero copy at the top; remaining panel is a full-bleed transparent Spline canvas
 * (live on desktop, static fallback for compact / reduced-motion).
 */
export function SignInVisual({ surface = "canvas" }: { surface?: "canvas" | "clear" }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isDesktopViewport = useMediaQuery("(min-width: 1024px)");
  const hasFinePointer = useMediaQuery("(pointer: fine)");
  const useLiveScene = isDesktopViewport && !prefersReducedMotion;
  const parallaxEnabled = useLiveScene && hasFinePointer;
  const cardRef = useRef<HTMLDivElement>(null);
  const artworkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    const artwork = artworkRef.current;
    if (!parallaxEnabled || !card || !artwork) return;

    const apply = (offset: typeof artworkParallaxRest) => {
      artwork.style.setProperty("--artwork-x", offset.x);
      artwork.style.setProperty("--artwork-y", offset.y);
      artwork.style.setProperty("--artwork-rx", offset.rx);
      artwork.style.setProperty("--artwork-ry", offset.ry);
    };
    const rest = () => apply(artworkParallaxRest);
    const onMove = (event: PointerEvent) => {
      const next = artworkParallax(event.clientX, event.clientY, card.getBoundingClientRect());
      if (next) apply(next);
    };

    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerleave", rest);
    return () => {
      card.removeEventListener("pointermove", onMove);
      card.removeEventListener("pointerleave", rest);
      rest();
    };
  }, [parallaxEnabled]);

  return (
    <div
      className={`relative flex h-full min-h-[320px] flex-col overflow-hidden lg:min-h-screen ${
        surface === "clear" ? "bg-transparent" : signInCanvasBackground
      }`}
      data-testid="signin-visual"
      data-visual-mode={useLiveScene ? "spline-live" : "static-fallback"}
    >
      <div className="motion-signin-enter relative z-10 shrink-0 px-8 pt-8 pb-6 text-left md:px-12 md:pt-12 md:pb-8">
        <div className="max-w-xl">
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

      <div
        ref={cardRef}
        className={`relative z-10 min-h-[220px] w-full min-w-0 flex-1 overflow-hidden bg-transparent sm:min-h-[260px] ${
          parallaxEnabled ? "motion-artwork-stage" : ""
        }`}
        data-testid="signin-visual-card"
        aria-hidden
      >
        {/* Explicit full-bleed box so @splinetool/react-spline ParentSize measures the panel. */}
        <div
          ref={artworkRef}
          className={`absolute inset-0 h-full w-full bg-transparent ${
            parallaxEnabled ? "motion-artwork-parallax" : ""
          }`}
          data-testid="signin-artwork"
          data-parallax={parallaxEnabled ? "on" : "off"}
        >
          {useLiveScene ? <SignInSplineScene /> : <SignInSceneFallback />}
        </div>
      </div>
    </div>
  );
}
