import { SignInForm } from "@/features/signin/SignInForm";
import { signInCanvasBackground, SignInVisual } from "@/features/signin/SignInVisual";
import { useMediaQuery, usePrefersReducedMotion } from "@/hooks/useMediaQuery";

const NETWORK_LOOP_URL = "/media/aegisbridge-network-loop.mp4";

/** Desktop composition targets ~824px visual / ~616px form at 1440px. */
export function SignInPage() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isDesktopViewport = useMediaQuery("(min-width: 1024px)");
  const showVideo = isDesktopViewport && !prefersReducedMotion;

  return (
    <div
      className="relative min-h-screen text-[var(--text)]"
      data-testid="signin-page"
      data-background={showVideo ? "video" : "static-canvas"}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {showVideo ? (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            data-testid="signin-background-video"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            src={NETWORK_LOOP_URL}
          />
        ) : (
          <div
            className={`absolute inset-0 ${signInCanvasBackground}`}
            data-testid="signin-static-background"
          />
        )}
        <div
          className="absolute inset-0 bg-[linear-gradient(165deg,rgba(7,16,28,0.78)_0%,rgba(4,10,20,0.88)_100%)]"
          data-testid="signin-readability-overlay"
        />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[minmax(0,1.34fr)_minmax(0,1fr)]">
        <section className="border-b border-[var(--border)] lg:border-r lg:border-b-0">
          <SignInVisual surface={showVideo ? "clear" : "canvas"} />
        </section>
        <section>
          <SignInForm />
        </section>
      </div>
    </div>
  );
}
