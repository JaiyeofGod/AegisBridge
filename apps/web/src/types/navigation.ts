export type AppRoutePath =
  | "/signin"
  | "/overview"
  | "/governance"
  | "/risks"
  | "/assets"
  | "/vulnerabilities"
  | "/soc"
  | "/incidents"
  | "/threat-intelligence"
  | "/cyber-range"
  | "/reports"
  | "/administration"
  | "/account/profile"
  | "/account/security"
  | "/account/preferences"
  | "/account/workspace";

export type NavItem = {
  label: string;
  to: AppRoutePath;
  implemented: boolean;
};
