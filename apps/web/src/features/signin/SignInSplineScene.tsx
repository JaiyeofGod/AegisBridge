import { useEffect, useState } from "react";

import { SignInSceneFallback } from "@/features/signin/SignInSceneFallback";
import { SPLINE_PUBLIC_SCENE_URL } from "@/features/signin/spline";

type SceneStatus = "loading" | "ready" | "error";

/**
 * Lazy-mounted Spline public preview embed.
 * Isolated from the sign-in form column; decorative only (no focus trap into form).
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
      className="relative h-full min-h-[240px] w-full overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]"
      data-testid="signin-spline-scene"
      data-scene-status={status}
    >
      {/* Fallback stays underneath until the iframe reports ready (or on error). */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          status === "ready" ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <SignInSceneFallback />
      </div>

      {shouldMount ? (
        <iframe
          title="AegisBridge cybersecurity scene"
          src={SPLINE_PUBLIC_SCENE_URL}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className={`absolute inset-0 h-full w-full border-0 transition-opacity duration-500 ${
            status === "ready" ? "opacity-100" : "opacity-0"
          }`}
          // Decorative: keep out of tab order so it cannot trap keyboard focus from the form.
          tabIndex={-1}
          aria-hidden
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
          // Subtle pointer response only; no keyboard interaction.
          style={{ pointerEvents: status === "ready" ? "auto" : "none" }}
        />
      ) : null}

      {status === "loading" ? (
        <p className="sr-only" role="status">
          Loading brand scene
        </p>
      ) : null}
    </div>
  );
}
