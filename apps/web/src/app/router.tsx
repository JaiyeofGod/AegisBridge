import { Navigate, Route, Routes } from "react-router-dom";

import { PreferencesPage } from "@/features/account/PreferencesPage";
import { ProfilePage } from "@/features/account/ProfilePage";
import { SecurityPage } from "@/features/account/SecurityPage";
import { WorkspacePage } from "@/features/account/WorkspacePage";
import { AdministrationPage } from "@/features/administration/AdministrationPage";
import { AssetDetailPage } from "@/features/assets/AssetDetailPage";
import { AssetInventoryPage } from "@/features/assets/AssetInventoryPage";
import { CyberRangePage } from "@/features/cyber-range/CyberRangePage";
import { GovernancePage } from "@/features/governance/GovernancePage";
import { IncidentPage } from "@/features/incidents/IncidentPage";
import { OverviewPage } from "@/features/overview/OverviewPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { RiskPage } from "@/features/risk/RiskPage";
import { SignInPage } from "@/features/signin/SignInPage";
import { SocPage } from "@/features/soc/SocPage";
import { ThreatIntelPage } from "@/features/threat-intel/ThreatIntelPage";
import { VulnerabilityPage } from "@/features/vulnerabilities/VulnerabilityPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/signin" replace />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/overview" element={<OverviewPage />} />
      <Route path="/governance" element={<GovernancePage />} />
      <Route path="/risks" element={<RiskPage />} />

      <Route path="/assets" element={<AssetInventoryPage />} />
      <Route path="/assets/:assetId" element={<AssetDetailPage />} />
      <Route path="/vulnerabilities" element={<VulnerabilityPage />} />
      <Route path="/soc" element={<SocPage />} />
      <Route path="/incidents" element={<IncidentPage />} />
      <Route path="/threat-intelligence" element={<ThreatIntelPage />} />
      <Route path="/cyber-range" element={<CyberRangePage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/administration" element={<AdministrationPage />} />
      <Route path="/account/profile" element={<ProfilePage />} />
      <Route path="/account/security" element={<SecurityPage />} />
      <Route path="/account/preferences" element={<PreferencesPage />} />
      <Route path="/account/workspace" element={<WorkspacePage />} />

      <Route path="*" element={<Navigate to="/signin" replace />} />
    </Routes>
  );
}
