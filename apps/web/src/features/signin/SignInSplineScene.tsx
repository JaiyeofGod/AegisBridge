import { Component, lazy, Suspense, useState, type ErrorInfo, type ReactNode } from "react";
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
 * Spline may inject an empty sandbox iframe with an opaque sheet.
 * Hide those overlays so the WebGL canvas remains visible in the card.
 */
function neutralizeHtmlOverlay(root: HTMLElement) {
  root.querySelectorAll("iframe").forEach((iframe) => {
    iframe.style.display = "none";
    iframe.style.pointerEvents = "none";
    iframe.setAttribute("aria-hidden", "true");
  });
}

/**
 * Official @splinetool/react-spline runtime using the self-hosted .splinecode.
 * Mounts immediately so ParentSize can measure the explicit card box.
 */
export function SignInSplineScene() {
  const [status, setStatus] = useState<SceneStatus>("loading");

  const handleLoad = (app: Application) => {
    try {
      app.setBackgroundColor("rgba(0,0,0,0)");
      const root = app.canvas.parentElement;
      if (root) {
        neutralizeHtmlOverlay(root);
      }
    } finally {
      setStatus("ready");
    }
  };

  const showFallback = status !== "ready";

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-transparent"
      data-testid="signin-spline-scene"
      data-scene-status={status}
      data-embed-mode="react-spline"
    >
      <div
        className={`absolute inset-0 z-0 transition-opacity duration-500 ${
          showFallback ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <SignInSceneFallback />
      </div>

      {status !== "error" ? (
        <div
          className={`absolute inset-0 z-10 bg-transparent transition-opacity duration-700 [&_iframe]:hidden ${
            status === "ready" ? "opacity-100" : "opacity-0"
          }`}
        >
          <SceneErrorBoundary onError={() => setStatus("error")}>
            <Suspense fallback={null}>
              <Spline
                scene={SPLINE_SCENE_CODE_URL}
                onLoad={handleLoad}
                className="h-full w-full bg-transparent [&_canvas]:block [&_canvas]:h-full [&_canvas]:w-full [&_canvas]:bg-transparent"
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
