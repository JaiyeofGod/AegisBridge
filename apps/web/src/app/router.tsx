import { Navigate, Route, Routes } from "react-router-dom";

import { ComingSoonPage } from "@/app/ComingSoonPage";
import { OverviewPage } from "@/features/overview/OverviewPage";
import { SignInPage } from "@/features/signin/SignInPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/signin" replace />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/overview" element={<OverviewPage />} />

      {/* Route foundations only — pages not built in Phase 1 */}
      <Route path="/governance" element={<ComingSoonPage title="Governance & Compliance" />} />
      <Route path="/risks" element={<ComingSoonPage title="Risk Management" />} />
      <Route path="/assets" element={<ComingSoonPage title="Assets" />} />
      <Route path="/assets/:assetId" element={<ComingSoonPage title="Asset details" />} />
      <Route path="/vulnerabilities" element={<ComingSoonPage title="Vulnerabilities" />} />
      <Route path="/soc" element={<ComingSoonPage title="SOC Operations" />} />
      <Route path="/incidents" element={<ComingSoonPage title="Incidents" />} />
      <Route path="/threat-intelligence" element={<ComingSoonPage title="Threat Intelligence" />} />
      <Route path="/cyber-range" element={<ComingSoonPage title="Cyber Range" />} />
      <Route path="/reports" element={<ComingSoonPage title="Reports & Analytics" />} />
      <Route path="/administration" element={<ComingSoonPage title="Administration" />} />
      <Route path="/account/profile" element={<ComingSoonPage title="My Profile" />} />
      <Route path="/account/security" element={<ComingSoonPage title="Account Security" />} />
      <Route path="/account/preferences" element={<ComingSoonPage title="Preferences" />} />
      <Route path="/account/workspace" element={<ComingSoonPage title="Workspace" />} />

      <Route path="*" element={<Navigate to="/signin" replace />} />
    </Routes>
  );
}
