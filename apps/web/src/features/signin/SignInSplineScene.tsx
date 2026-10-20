import { useEffect, useState } from "react";

import { SignInSceneFallback } from "@/features/signin/SignInSceneFallback";
import { SPLINE_PUBLIC_SCENE_URL } from "@/features/signin/spline";

type SceneStatus = "loading" | "ready" | "error";

/**
 * Lazy-mounted Spline public-preview embed (iframe).
 * Blended into the left panel — no card border. Cross-origin iframe cannot
 * enable transparent BG or remove branding; that requires Play Settings + Code export.
 */
export function SignInSplineScene() {
  const [status, setStatus] = useState<SceneStatus>("loading");
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: number | undefined;

    const enable = () => {
      if (!cancelled) setShouldMount(true);
    };

    const win = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };

    if (typeof win.requestIdleCallback === "function") {
      idleId = win.requestIdleCallback(enable, { timeout: 1200 });
    } else {
      timeoutId = win.setTimeout(enable, 200);
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) {
        win.clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <div
      className="relative h-full min-h-[280px] w-full overflow-hidden bg-transparent"
      data-testid="signin-spline-scene"
      data-scene-status={status}
      data-embed-mode="public-iframe"
    >
      {/* Soft underlay matching the left-panel gradient (iframe BG is opaque today). */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(90% 70% at 50% 55%, #1b3344 0%, #0c1118 58%, #082126 100%)",
        }}
        aria-hidden
      />

      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          status === "ready" ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <SignInSceneFallback />
      </div>

      {shouldMount ? (
        <div
          className={`absolute inset-0 transition-opacity duration-700 ${
            status === "ready" ? "opacity-100" : "opacity-0"
          }`}
          // Feather edges so the opaque iframe reads as part of the panel, not a card.
          style={{
            maskImage:
              "radial-gradient(ellipse 92% 78% at 50% 48%, #000 42%, transparent 78%), linear-gradient(to bottom, transparent 0%, #000 12%, #000 72%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 92% 78% at 50% 48%, #000 42%, transparent 78%), linear-gradient(to bottom, transparent 0%, #000 12%, #000 72%, transparent 100%)",
          }}
        >
          <iframe
            title="AegisBridge cybersecurity scene"
            src={SPLINE_PUBLIC_SCENE_URL}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 h-full w-full border-0 bg-transparent"
            tabIndex={-1}
            aria-hidden
            onLoad={() => setStatus("ready")}
            onError={() => setStatus("error")}
            style={{ pointerEvents: status === "ready" ? "auto" : "none" }}
          />
        </div>
      ) : null}

      {/* Top/bottom color washes to further merge with panel chrome */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#0c1118] to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#082126] via-[#0c1118]/85 to-transparent"
        aria-hidden
      />

      {status === "loading" ? (
        <p className="sr-only" role="status">
          Loading brand scene
        </p>
      ) : null}
    </div>
  );
}
