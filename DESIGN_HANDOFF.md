# AegisBridge Security Operations & GRC Platform

## UI/UX Engineering Handoff

**Document version:** 1.0  
**Design baseline:** October 20, 2026  
**Design status:** Approved visual direction and initial desktop screens  
**Primary design tool:** Figma  
**3D authoring tool:** Spline  
**Development IDE:** Cursor  
**Frontend target:** React + TypeScript + Vite  
**Architecture source of truth:** `MASTER_REQUIREMENTS.md`  
**Visual source of truth:** Approved Figma screens  

---

## 1. Purpose and Scope

This document guides the implementation of the approved AegisBridge
interface.

The initial design phase established the visual direction, main module
screens, account screens, welcome/sign-in screen, prototype navigation,
and a supporting Spline cybersecurity scene.

These designs are the starting point for implementation. They do not
define every form, subtab, responsive layout, or interaction state.

Creating this handoff does not authorize skipping the Phase 0 review
required by `MASTER_REQUIREMENTS.md`.

## 2. Source of Truth

Use the following sources together:

| Source | Authority |
|---|---|
| `MASTER_REQUIREMENTS.md` | Product behavior, architecture, security, data, integrations, and development phases |
| `DESIGN_HANDOFF.md` | Frontend implementation guidance and known design limitations |
| Approved Figma screens | Visual appearance, layout, typography, and component patterns |
| Spline source | Editable 3D scene |

If these sources conflict, record the conflict before implementing the
affected behavior. Security and authorization requirements must not be
weakened to match a visual mockup.

Preserve the approved visual direction. Reuse existing Figma patterns
before introducing new ones.

When a required detail is missing, extend the existing design system
and document the decision. Do not silently redesign a module.

## 3. Figma References

### Main design file

https://www.figma.com/design/iDkPVAlMAdCokcvecFF8vC

### Overview dashboard

https://www.figma.com/design/iDkPVAlMAdCokcvecFF8vC?node-id=2-63

Figma node ID:

```text
2:63
```

### Welcome and sign-in

https://www.figma.com/design/iDkPVAlMAdCokcvecFF8vC?node-id=25-574

Figma node ID:

```text
25:574
```

Inspect the actual Figma layers, variables, components, and spacing
before implementation. Do not infer the entire interface from a
single screenshot.

If Figma access is unavailable, report that limitation and request
the necessary exports before claiming visual fidelity.

## 4. Approved Visual Direction

The application uses:

- Graphite and deep navy surfaces.
- Restrained cyan accents.
- Manrope headings.
- Inter for interface text and data.
- Subtle borders and limited shadows.
- Consistent spacing and clear hierarchy.
- Severity labels that communicate meaning through text as well as color.

Use the values defined in Figma for colors, spacing, typography,
radii, and component states. Avoid scattering hardcoded values
through individual components.

Dark mode is the primary implemented design reference. Complementary
light tokens exist, but a complete light-theme screen set has not
been validated.

Keep operational tables, forms, and investigation screens readable.
Use decorative depth and 3D selectively.

## 5. Available Screen Designs

The Figma file contains initial designs for:

1. Overview
2. Governance & Compliance
3. Risk Management
4. Assets
5. Vulnerabilities
6. SOC Operations
7. Incidents
8. Threat Intelligence
9. Cyber Range
10. Reports & Analytics
11. Administration

Additional screens include:

- FIN-APP-01 asset details.
- My Profile.
- Account Security.
- Preferences.
- Workspace.
- Welcome and sign-in.

The Cyber Range design currently includes a 2D network segment view.
A custom interactive 3D topology has not been built.

These are initial screen designs, not complete implementations of
every feature in the master requirements.

## 6. Navigation and Proposed Routes

The following routes are proposed implementation paths. They are
not an existing backend API contract.

| Screen | Proposed route |
|---|---|
| Welcome / Sign-in | `/signin` |
| Overview | `/overview` |
| Governance & Compliance | `/governance` |
| Risk Management | `/risks` |
| Assets | `/assets` |
| Asset details | `/assets/:assetId` |
| Vulnerabilities | `/vulnerabilities` |
| SOC Operations | `/soc` |
| Incidents | `/incidents` |
| Threat Intelligence | `/threat-intelligence` |
| Cyber Range | `/cyber-range` |
| Reports & Analytics | `/reports` |
| Administration | `/administration` |
| My Profile | `/account/profile` |
| Account Security | `/account/security` |
| Preferences | `/account/preferences` |
| Workspace | `/account/workspace` |

Preserve these navigation behaviors:

- Clicking the AegisBridge brand returns to Overview.
- Clicking the account area opens My Profile.
- Clicking the workspace card opens Workspace.
- Account tabs connect Profile, Security, and Preferences.
- Asset records open their corresponding details.
- Related records should link to their actual destinations.

Navigation visibility must follow the role model in
`MASTER_REQUIREMENTS.md`. Hiding an item is not a substitute for
server-side authorization.

## 7. Reusable Frontend Structure

Build shared components for recurring interface patterns, including:

- Application shell and sidebar.
- Page headers and breadcrumbs.
- Buttons and links.
- Form fields and validation messages.
- Status and severity badges.
- Metric summaries.
- Data tables and pagination.
- Filters and search controls.
- Tabs.
- Empty, loading, and error states.
- Confirmation dialogs where required.

Keep reusable UI components separate from module-specific data logic.

Use semantic HTML. Do not recreate the interface as a screenshot,
canvas drawing, or collection of absolutely positioned elements.

Figma auto layout should translate into appropriate CSS layout,
usually Flexbox or Grid.

## 8. Dashboard Metrics and Sample Data

The overview emphasizes:

- Priority actions.
- Vulnerability exposure.
- Active incidents.
- Critical risks.
- Assessment progress.
- Telemetry coverage.
- Integration health and freshness.

Do not invent a composite security score.

Each implemented metric must define:

- What it measures.
- Its scope and filters.
- Its denominator, where applicable.
- Its data source.
- Its reporting period or last update time.
- How unknown, stale, or missing data is represented.

Missing data must not appear as a healthy result or a zero count.

Figma values are simulated examples. Keep frontend fixtures clearly
separate from connected application data.

Demo screens must visibly identify simulated data. Do not present
sample alerts, evidence, compliance results, or integration statuses
as verified operational results.

## 9. Authentication and Demo Behavior

The welcome screen proposes:

- A work email field.
- Organization SSO.
- Authentication guidance.
- An Explore the demo entry.
- An authorized-access notice.

The Figma SSO button is a design concept. Implement authentication
according to `MASTER_REQUIREMENTS.md` and the documented architecture
decisions.

If the planned authentication method differs from the mockup, record
and resolve the discrepancy before connecting the sign-in flow.

The prototype demo entry currently navigates to Overview. The working
application must apply the demo restrictions defined in the master plan.

Do not create a production authentication bypass to reproduce a
prototype interaction.

## 10. Spline Scene and Assets

### Editable scene

https://app.spline.design/file/3c479e64-e72d-4925-be5a-adb8a87528b2

### Public preview

https://my.spline.design/aegisbridgecybersecurityscene-dRDuyGtdof1qLahfmB6r1TFz/

The scene depicts a miniature cybersecurity environment with a
protected core, server area, endpoint workstation, governance
documents, and cyan connections.

Figma contains a static image preview. It does not contain the
interactive Spline scene.

The public preview URL is not necessarily the runtime scene URL.
Obtain the appropriate Spline export or embed configuration before
integration. Do not use the editor URL as a runtime asset.

A static export must remain available as the fallback image.
The current Figma mockup uses the earlier JPG export.

Subtle animation was requested in Spline, but its playback has not
been independently verified in this handoff.

## 11. 3D Integration Requirements

For the welcome screen:

- Render essential sign-in controls independently of the 3D scene.
- Load the scene after essential interface content.
- Show the static fallback while loading or on failure.
- Respect reduced-motion preferences.
- Use the static version on devices where 3D performs poorly.
- Keep scene interaction separate from authentication controls.
- Prevent keyboard or pointer traps.
- Preserve the approved camera composition and visual palette.
- Verify animation, loading behavior, and resource usage in browsers.

Choose the integration method after checking the available Spline
export and application requirements.

React Three Fiber or Three.js is not required merely to display
the Spline brand scene.

Evaluate custom 3D separately if future cyber-range topology features
need selectable live assets, filtering, threat paths, or other
data-driven behavior. Preserve a usable 2D alternative.

## 12. Responsive Behavior and Accessibility

Use the 1440 px desktop designs as the main visual baseline.

Detailed smaller-screen layouts remain to be refined. Adapt the
existing hierarchy rather than shrinking the entire desktop screen.

Implementation requirements include:

- Collapsible or alternative navigation on smaller screens.
- Readable tables with appropriate overflow behavior.
- Visible keyboard focus.
- Accessible names for icon controls.
- Persistent form labels.
- Clear validation and error messages.
- Status text that does not depend on color alone.
- Appropriate contrast.
- Reduced-motion support.
- Logical keyboard order.

Treat accessibility as an implementation requirement to verify,
not as a completed certification of the Figma designs.

## 13. Required Interaction States

Complete the states relevant to each implemented workflow:

- Default.
- Hover.
- Keyboard focus.
- Selected.
- Disabled.
- Loading.
- Empty.
- Error.
- Success.
- Permission denied, where applicable.
- Stale or unavailable integration data, where applicable.

Some initial button variants exist in Figma. A complete state set
for every component and workflow has not yet been designed.

Do not leave important controls as silent no-ops. If a feature is
outside the current phase, identify that limitation clearly.

## 14. Implementation Sequence

Follow the phases and exit gates in `MASTER_REQUIREMENTS.md`.

When frontend implementation is authorized for the relevant phase:

1. Inspect the Figma foundations and target screens.
2. Establish shared tokens and typography.
3. Build the application shell and reusable components.
4. Implement Overview with clearly labeled fixtures.
5. Compare the browser result with the Figma reference.
6. Expand into the module screens in the approved phase order.
7. Implement the welcome screen with static artwork first.
8. Add the actual Spline integration and fallbacks.
9. Connect backend behavior only as authorized by the roadmap.
10. Verify responsive layouts, accessibility, and interaction states.

Do not build all modules at once or treat this handoff as permission
to skip architecture, security, or data planning.

## 15. Review and Acceptance

For each implemented screen:

- Compare it with the corresponding Figma reference.
- Check typography, spacing, colors, alignment, and content hierarchy.
- Verify navigation and relevant interaction states.
- Check smaller-screen behavior.
- Verify keyboard access and focus.
- Confirm simulated and connected data are distinguishable.
- Run checks appropriate to the functionality changed.
- Record remaining limitations honestly.

Frontend visual completion does not establish backend readiness,
security compliance, or completion of the overall project.

## 16. Known Remaining Design Work

The following areas need further refinement during the relevant phases:

- Detailed module subtabs.
- Create and edit forms.
- Advanced filtering and search.
- Complete loading, empty, and error states.
- Smaller-screen layouts.
- A fully reviewed light theme.
- End-to-end authentication flows.
- Detailed role-specific experiences.
- Live integration states.
- Custom spatial topology, if justified.

Preserve the approved visual direction while resolving these gaps.
