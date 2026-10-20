import type { NavItem } from "@/types/navigation";

export const primaryNav: NavItem[] = [
  { label: "Overview", to: "/overview", implemented: true },
  { label: "Governance & Compliance", to: "/governance", implemented: true },
  { label: "Risk Management", to: "/risks", implemented: true },
  { label: "Assets", to: "/assets", implemented: true },
  { label: "Vulnerabilities", to: "/vulnerabilities", implemented: true },
  { label: "SOC Operations", to: "/soc", implemented: true },
  { label: "Incidents", to: "/incidents", implemented: true },
  { label: "Threat Intelligence", to: "/threat-intelligence", implemented: true },
  { label: "Cyber Range", to: "/cyber-range", implemented: true },
  { label: "Reports & Analytics", to: "/reports", implemented: false },
  { label: "Administration", to: "/administration", implemented: false },
];
