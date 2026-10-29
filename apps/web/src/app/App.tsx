import { BrowserRouter } from "react-router-dom";

import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";

function MotionDocumentSync() {
  usePrefersReducedMotion();
  return null;
}

export function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <MotionDocumentSync />
        <AppRouter />
      </BrowserRouter>
    </AppProviders>
  );
}
