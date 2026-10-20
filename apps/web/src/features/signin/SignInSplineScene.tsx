import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import type { Application } from "@splinetool/runtime";

import { SignInSceneFallback } from "@/features/signin/SignInSceneFallback";
import { SPLINE_SCENE_CODE_URL } from "@/features/signin/spline";

type SceneStatus = "loading" | "ready" | "error";

const Spline = lazy(() => import("@splinetool/react-spline"));

type SceneErrorBoundaryProps = {
  onError: () => void;
  children: ReactNode;
};

type SceneErrorBoundaryState = { failed: boolean };

class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, SceneErrorBoundaryState> {
  state: SceneErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onError();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

/**
 * Spline's sandbox HTML overlay is an empty iframe with `color-scheme: normal`,
 * which paints an opaque white sheet over the canvas. Neutralize it so only
 * the 3D art remains (over the page panel gradient).
 */
function neutralizeHtmlOverlay(root: HTMLElement) {
  root.querySelectorAll("iframe").forEach((iframe) => {
    iframe.style.display = "none";
    iframe.style.pointerEvents = "none";
    iframe.setAttribute("aria-hidden", "true");
  });
}

/**
 * Lazy-mounted official Spline React runtime.
 * Transparent canvas so the left-panel gradient shows behind the 3D art.
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

  const handleLoad = (app: Application) => {
    // Clear only the scene/canvas fill — 3D art stays unchanged.
    app.setBackgroundColor("rgba(0,0,0,0)");

    const root = app.canvas.parentElement;
    if (root) {
      neutralizeHtmlOverlay(root);
    }

    setStatus("ready");
  };

  const showFallback = status !== "ready";

  return (
    <div
      className="relative h-full min-h-[280px] w-full overflow-hidden bg-transparent"
      data-testid="signin-spline-scene"
      data-scene-status={status}
      data-embed-mode="react-spline"
    >
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          showFallback ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <SignInSceneFallback />
      </div>

      {shouldMount && status !== "error" ? (
        <div
          className={`absolute inset-0 bg-transparent transition-opacity duration-700 [&_iframe]:hidden ${
            status === "ready" ? "opacity-100" : "opacity-0"
          }`}
        >
          <SceneErrorBoundary onError={() => setStatus("error")}>
            <Suspense fallback={null}>
              <Spline
                scene={SPLINE_SCENE_CODE_URL}
                onLoad={handleLoad}
                className="absolute inset-0 h-full w-full bg-transparent [&_canvas]:bg-transparent"
                style={{ background: "transparent", width: "100%", height: "100%" }}
              />
            </Suspense>
          </SceneErrorBoundary>
        </div>
      ) : null}

      {status === "loading" ? (
        <p className="sr-only" role="status">
          Loading brand scene
        </p>
      ) : null}
    </div>
  );
}
