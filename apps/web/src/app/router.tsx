import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { LoadingState } from "@/components/feedback/LoadingState";
import { GuestOnly, RequireAuth } from "@/features/auth/RequireAuth";

const SignInPage = lazy(() =>
  import("@/features/signin/SignInPage").then((module) => ({ default: module.SignInPage })),
);
const OverviewPage = lazy(() =>
  import("@/features/overview/OverviewPage").then((module) => ({ default: module.OverviewPage })),
);
const GovernancePage = lazy(() =>
  import("@/features/governance/GovernancePage").then((module) => ({
    default: module.GovernancePage,
  })),
);
const RiskPage = lazy(() =>
  import("@/features/risk/RiskPage").then((module) => ({ default: module.RiskPage })),
);
const AssetInventoryPage = lazy(() =>
  import("@/features/assets/AssetInventoryPage").then((module) => ({
    default: module.AssetInventoryPage,
  })),
);
const AssetDetailPage = lazy(() =>
  import("@/features/assets/AssetDetailPage").then((module) => ({
    default: module.AssetDetailPage,
  })),
);
const VulnerabilityPage = lazy(() =>
  import("@/features/vulnerabilities/VulnerabilityPage").then((module) => ({
    default: module.VulnerabilityPage,
  })),
);
const SocPage = lazy(() =>
  import("@/features/soc/SocPage").then((module) => ({ default: module.SocPage })),
);
const IncidentPage = lazy(() =>
  import("@/features/incidents/IncidentPage").then((module) => ({ default: module.IncidentPage })),
);
const ThreatIntelPage = lazy(() =>
  import("@/features/threat-intel/ThreatIntelPage").then((module) => ({
    default: module.ThreatIntelPage,
  })),
);
const CyberRangePage = lazy(() =>
  import("@/features/cyber-range/CyberRangePage").then((module) => ({
    default: module.CyberRangePage,
  })),
);
const ReportsPage = lazy(() =>
  import("@/features/reports/ReportsPage").then((module) => ({ default: module.ReportsPage })),
);
const AdministrationPage = lazy(() =>
  import("@/features/administration/AdministrationPage").then((module) => ({
    default: module.AdministrationPage,
  })),
);
const ProfilePage = lazy(() =>
  import("@/features/account/ProfilePage").then((module) => ({ default: module.ProfilePage })),
);
const SecurityPage = lazy(() =>
  import("@/features/account/SecurityPage").then((module) => ({ default: module.SecurityPage })),
);
const PreferencesPage = lazy(() =>
  import("@/features/account/PreferencesPage").then((module) => ({
    default: module.PreferencesPage,
  })),
);
const WorkspacePage = lazy(() =>
  import("@/features/account/WorkspacePage").then((module) => ({ default: module.WorkspacePage })),
);

function RouteFallback() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
      <LoadingState label="Loading page" />
    </div>
  );
}

function Protected({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}

export function AppRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/signin" replace />} />
        <Route
          path="/signin"
          element={
            <GuestOnly>
              <SignInPage />
            </GuestOnly>
          }
        />
        <Route
          path="/overview"
          element={
            <Protected>
              <OverviewPage />
            </Protected>
          }
        />
        <Route
          path="/governance"
          element={
            <Protected>
              <GovernancePage />
            </Protected>
          }
        />
        <Route
          path="/risks"
          element={
            <Protected>
              <RiskPage />
            </Protected>
          }
        />
        <Route
          path="/assets"
          element={
            <Protected>
              <AssetInventoryPage />
            </Protected>
          }
        />
        <Route
          path="/assets/:assetId"
          element={
            <Protected>
              <AssetDetailPage />
            </Protected>
          }
        />
        <Route
          path="/vulnerabilities"
          element={
            <Protected>
              <VulnerabilityPage />
            </Protected>
          }
        />
        <Route
          path="/soc"
          element={
            <Protected>
              <SocPage />
            </Protected>
          }
        />
        <Route
          path="/incidents"
          element={
            <Protected>
              <IncidentPage />
            </Protected>
          }
        />
        <Route
          path="/threat-intelligence"
          element={
            <Protected>
              <ThreatIntelPage />
            </Protected>
          }
        />
        <Route
          path="/cyber-range"
          element={
            <Protected>
              <CyberRangePage />
            </Protected>
          }
        />
        <Route
          path="/reports"
          element={
            <Protected>
              <ReportsPage />
            </Protected>
          }
        />
        <Route
          path="/administration"
          element={
            <Protected>
              <AdministrationPage />
            </Protected>
          }
        />
        <Route
          path="/account/profile"
          element={
            <Protected>
              <ProfilePage />
            </Protected>
          }
        />
        <Route
          path="/account/security"
          element={
            <Protected>
              <SecurityPage />
            </Protected>
          }
        />
        <Route
          path="/account/preferences"
          element={
            <Protected>
              <PreferencesPage />
            </Protected>
          }
        />
        <Route
          path="/account/workspace"
          element={
            <Protected>
              <WorkspacePage />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/signin" replace />} />
      </Routes>
    </Suspense>
  );
}
