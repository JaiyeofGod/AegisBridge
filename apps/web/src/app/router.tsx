import { Navigate, Route, Routes } from "react-router-dom";

import { ComingSoonPage } from "@/app/ComingSoonPage";
import { AssetDetailPage } from "@/features/assets/AssetDetailPage";
import { AssetInventoryPage } from "@/features/assets/AssetInventoryPage";
import { GovernancePage } from "@/features/governance/GovernancePage";
import { OverviewPage } from "@/features/overview/OverviewPage";
import { RiskPage } from "@/features/risk/RiskPage";
import { SignInPage } from "@/features/signin/SignInPage";
import { SocPage } from "@/features/soc/SocPage";
import { VulnerabilityPage } from "@/features/vulnerabilities/VulnerabilityPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/signin" replace />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/overview" element={<OverviewPage />} />
      <Route path="/governance" element={<GovernancePage />} />
      <Route path="/risks" element={<RiskPage />} />

      {/* Route foundations only — modules not built yet */}
      <Route path="/assets" element={<AssetInventoryPage />} />
      <Route path="/assets/:assetId" element={<AssetDetailPage />} />
      <Route path="/vulnerabilities" element={<VulnerabilityPage />} />
      <Route path="/soc" element={<SocPage />} />
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
