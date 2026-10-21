# Frontend audit

Audit date: 20 Oct 2026. Scope is the implemented web client only. No new product modules were added. The dev server was not started; route behavior was checked through the Vitest suite and the production build.

## Routes reviewed

| Route | Result |
|---|---|
| `/signin` | Renders the welcome and sign-in screen. Email submit and organization SSO stay disabled. Explore demo opens Overview and is labeled simulated. |
| `/overview` | Renders inside AppShell with metrics, My Work, and executive sections. |
| `/governance` | Renders. Sidebar link matches `/governance`. |
| `/risks` | Renders. Sidebar link matches `/risks`. |
| `/assets` | Renders the inventory. |
| `/assets/FIN-APP-01` | Renders the FIN-APP-01 detail record (`AST-0007`). |
| `/vulnerabilities` | Renders. Asset links are emitted only when a slug exists. |
| `/soc` | Renders. Wazuh is described as the system of record, not a live connection. |
| `/incidents` | Renders. Lifecycle status stays separate from severity. |
| `/threat-intelligence` | Renders. Feeds are labeled simulated or not connected. |
| `/cyber-range` | Renders. Copy states the hosted app is not connected to a live lab. |
| `/reports` | Renders from the development API (definitions, dataset registry, experiments). No download or file generation is offered as a completed action. |
| `/administration` | Renders. Secrets are not shown. Connectors are not live. |
| `/account/profile` | Renders. Header **My Profile** opens this route. |
| `/account/security` | Renders. Password, MFA, and session actions are disabled. |
| `/account/preferences` | Renders. Local controls say they are not saved. |
| `/account/workspace` | Renders the current-user view and links to Administration. |

Direct access works for each route above. Unknown paths redirect to `/signin`. No implemented route renders `ComingSoonPage`. Primary navigation has no **Soon** badge. `ComingSoonPage` remains in the tree and is not mounted.

## Issues found

1. Control identifiers disagreed. Asset and vulnerability copy used `AC-02` and `SI-02`. Governance, risk, incidents, and overview use NIST-style `AC-2` and `SI-2` for the same account-management and flaw-remediation controls.
2. Overview My Work cited `INC-0003`, which is not an incident id. The authentication incident in the register is `INC-001`.
3. The production entry chunk included every page. It was about 675 kB before minification gzip of about 177 kB. Spline was already in separate chunks, but those chunks still loaded only after the sign-in scene imported them.
4. Sidebar, brand, search, notification, and shared button controls did not all carry the same explicit focus ring class used by page controls. A global `:focus-visible` rule already exists.
5. The disabled header search exposed the name “Search” without saying that search is not connected.
6. `prettier --check` failed on `ThreatIndicatorTable.tsx` before this audit’s formatting pass.
7. Several hostnames are mentioned without an inventory record, so they correctly do not link: `LINUX-APP-01`, `WEB-02`, and `APP-03`. `LINUX-APP-01` is a lab system and is documented as separate from the enterprise inventory.
8. FIN-APP-01 detail lists `AL-088`, `AL-091`, `VF-018`, `EV-067`, and `EV-072`. Those ids are not records in the SOC, vulnerability, or evidence modules.
9. Most section tab lists set `role="tab"` and `aria-selected` but do not set `aria-controls`, a tab panel, or arrow-key movement. Governance and Risk set `aria-controls` and `tabIndex`, and they also do not move focus with arrow keys.
10. The same tab-strip markup is copied across module pages instead of one shared control.
11. Light-theme tokens exist and are not applied. Dark tokens are the validated theme.
12. Preference theme and density update local labels only. They do not restyle the application, and the copy says they are not saved.
13. Spline runtime chunks remain larger than 500 kB. That size is the Spline runtime, not page code.

## Fixes made

- Aligned `AC-02` / `SI-02` to `AC-2` / `SI-2` on the FIN-APP-01 record and on VF-041.
- Pointed the overview work item at `INC-001` and matched its title to “Repeated authentication failures”.
- Lazy-loaded each route module. The sign-in scene stays behind its existing lazy Spline import and still falls back when reduced motion or a compact viewport is active.
- Added a route-resolution test for all implemented paths, including `/assets/FIN-APP-01`, and asserted that none of them show the unused “later phase” stub.
- Added the shared accent focus ring to the brand link, sidebar links, header search, notification button, and `Button`.
- Named the disabled search field so the reason it is unavailable is in the accessible name.
- Formatted `ThreatIndicatorTable.tsx` so `prettier --check` passes.
- Test renders now wait for the route loading state so lazy routes stay deterministic.

## Issues intentionally deferred

- Do not delete `ComingSoonPage` yet. Nothing routes to it. It is unused foundation code.
- Do not collapse the repeated section tabs into one component in this pass. The markup is duplicated, and a shared rewrite would touch every module test.
- Do not add arrow-key tab roving or `aria-controls` across every module. Governance and Risk are closer to the tab pattern; the other modules are clickable section buttons with tab roles. Behavior is usable with Tab and Enter.
- Do not invent inventory rows for `LINUX-APP-01`, `WEB-02`, or `APP-03`. Links are already omitted when `assetSlug` is null. The lab hostname stays distinct from `WAZUH-01` / `SEC-WAZUH-01` and `WIN-WS-07` / `WIN-USER-01`.
- Do not backfill `AL-088`, `AL-091`, `VF-018`, `EV-067`, or `EV-072` into other modules. They are labels on the FIN-APP-01 detail sample only.
- Do not apply the light theme or make preference controls change global tokens.
- Do not split or remove the Spline runtime. The remaining chunk warning is those runtime files.
- Role-based hiding of navigation was not added. The requirements treat hiding as presentation, not authorization, and this prototype shows the full module list.
- No browser pass was run.

## Accessibility findings

- Interactive controls in the shell and pages use a 44px minimum height (`min-h-11`) or a 44px square target for icon buttons.
- `:focus-visible` uses a 2px accent outline. Shared buttons and primary navigation now include that ring in their class list as well.
- Inputs and account fields have visible labels. Disabled prototype actions include a title and an accessible name that says they do not perform the action.
- Data tables that render include a caption and column headers. Several desktop tables are `md:block` with a stacked list below that breakpoint.
- Status badges include text. Freshness, severity, MFA, session, and account state are not color alone.
- Reduced motion still skips the live Spline scene and uses the static fallback. Global CSS shortens animation and transition duration when `prefers-reduced-motion` is set. The Spline canvas is `aria-hidden`, and its overlay iframes are hidden from assistive technology.
- Search and notifications explain that they are not connected. Both remain disabled.
- Gap: section tabs are not a full tab widget. See deferred items.

## Responsive findings

- The shell sidebar is visible from the `lg` breakpoint. Below that, navigation opens from the header menu.
- Page content uses a 1440px max width, 16px horizontal padding on small screens, and 32px from `md` up.
- Module tables that need it scroll or switch to a single-column list below `md`.
- Sign-in stacks the scene above the form below `lg` and does not mount the live scene below 1024px.
- Account pages use one column by default and a two-column panel grid from `xl`.
- No clear overflow or unreachable-control defect was fixed beyond the existing layout. Mobile workflows were not redesigned.

## Consistency findings

- Pages inside the product use `AppShell`, `PageHeader`, `Panel`, `StatusBadge`, and `SimulatedDataBanner`. Sign-in is the exception and does not use the shell, which matches the approved entry screen.
- Summary metrics use the shared card. Account screens do not show metric cards; the approved account frames do not either.
- Colors, type, radius, and borders come from `tokens.css`. No new tokens were added.
- Simulated labeling is present on every reviewed module. Copy does not claim a live Wazuh connection, a live threat feed, real authentication, stored evidence credentials, a connected cyber range, or a saved account change.
- CVSS, EPSS, KEV, criticality, exposure, and the Track / Track* / Attend / Act decision stay separate. Tests reject an aggregate security score, an aggregate vulnerability score, an aggregate threat score, and an authoritative maturity score.
- Alerts and incidents state that an alert alone is not confirmed compromise.
- The current account is synthetic `USR-001` Amara Okonkwo. That matches Administration and avoids the personal identity drawn on the Figma profile frame.

## Bundle and build findings

- Route-level `React.lazy` split each page out of the entry chunk. The entry chunk is now `index-BbpNn8dd.js` at 307.91 kB (96.58 kB gzip), down from about 675 kB (177 kB gzip) when every page was static.
- Sign-in remains its own chunk (`SignInPage`, about 10 kB). `@splinetool/react-spline` stays a separate chunk (about 281 kB). The scene still loads only for the large, motion-allowed sign-in panel.
- Vite still warns because Spline runtime chunks exceed 500 kB: `runtime-classicRuntime` at 624.83 kB and `runtime-chunk-3Q4J5ROW` at 646.57 kB. Those files are the Spline runtime. They were not rewritten.
- Lint, Prettier, TypeScript, Vitest (65 tests, 15 files), and the production build passed after the fixes.

## Readiness assessment

The frontend is internally consistent enough to start backend integration. Routes, shell, simulated labeling, and the security-language constraints are in place. Integration should treat all current data as fixtures: identifiers are stable samples, not an API contract, and a few detail-only ids listed above are not shared across modules.

**Ready for backend integration**, with the deferred items above left as follow-up rather than blockers.
