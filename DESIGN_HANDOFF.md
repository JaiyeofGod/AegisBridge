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


## 17. Animation and Cinematic Motion Plan

### 17.1. Goal

Give AegisBridge a polished, cinematic welcome experience and subtle,
useful motion throughout the application.

Preserve the approved Figma layouts, typography, colors, and navigation.
Motion should explain changes, guide attention, and strengthen the brand.

This section is a proposed implementation specification. It does not
mean these animations have already been built or verified.

### 17.2. Tools and Responsibilities

| Tool | Responsibility |
|---|---|
| Figma | Reference for layouts, visual states, and interaction annotations |
| Spline | Camera movement, lighting, and animation inside the existing 3D scene |
| CSS | Simple hover, focus, opacity, and color transitions |
| Frontend animation library, if needed | Coordinated entrances, drawers, and scroll-linked sequences |
| Cursor | Implement, integrate, and verify the motion behavior |

No additional Figma plugin is required.

Inspect existing frontend dependencies before adding an animation
library. Use the smallest suitable approach and avoid multiple libraries
for overlapping tasks.

### 17.3. Motion Levels

Use three levels of motion:

1. Cinematic motion on the welcome page and any future public landing page.
2. Short interface transitions for navigation, tabs, and drawers.
3. Minimal feedback for loading, saving, and data updates.

Operational screens must remain stable and readable.

### 17.4. Welcome Page Cinematic Sequence

Preserve the existing “Your Security Workspace” copy and approved layout.

On a fresh page entry:

- Render the sign-in form and static artwork immediately.
- Gently reveal the heading and supporting copy.
- Fade in the live Spline scene when it is ready.
- Run a restrained camera push toward the scene.
- Continue with subtle cyan pulses along existing connections.

Suggested timing targets:

| Element | Behavior | Duration |
|---|---|---|
| Heading and supporting copy | Fade with up to 8 px upward movement | 300–450 ms |
| Sign-in panel | Subtle opacity entrance; controls remain usable | 200–300 ms |
| Static-to-live artwork | Crossfade without changing layout size | 250–400 ms |
| Spline camera | Small push toward the protected core | 2–3 seconds |
| Circuit lighting | Gentle, low-intensity pulse | 6–8 second cycle |

Do not wait for the 3D scene before allowing sign-in.
Do not replay the entrance during typing, validation, or data updates.

Keep the full scene visible throughout the camera movement.
Avoid dramatic zooming, continuous rotation, flashing, and heavy bloom.

Camera and lighting changes require access to the editable Spline scene.
Do not assume the public preview exposes runtime camera controls.

### 17.5. Pointer Interaction

On supported desktop devices, allow a small pointer-responsive tilt
around the artwork.

- Limit the tilt to approximately 1–2 degrees.
- Return smoothly to the resting position when the pointer leaves.
- Apply the effect only to the artwork area.
- Do not move the sign-in form.
- Disable it for touch input and reduced-motion preferences.

Avoid combining strong camera movement, parallax, and tilt.
The overall composition should remain calm.

### 17.6. Application Motion

| Area | Behavior | Suggested duration |
|---|---|---|
| Sidebar | Smooth expand/collapse; active-item color transition | 150–220 ms |
| Tabs | Brief content fade, with minimal movement if useful | 120–180 ms |
| Drawers | Slide from the appropriate edge with a backdrop fade | 180–250 ms |
| Dialogs | Short fade with a very small scale change | 150–200 ms |
| Buttons | Color, border, and pressed-state feedback | 100–150 ms |
| Toasts | Brief entrance and exit without covering key controls | 150–200 ms |
| Cyber range selection | Highlight the selected asset and related paths | 150–250 ms |

Use a consistent ease-out curve for entrances and a short ease-in
curve for exits.

Keep keyboard focus and dialog behavior correct throughout transitions.
Animations must not delay navigation or block repeated input.

### 17.7. Tables, Metrics, and Data Updates

Keep operational data visually stable.

- Preserve table position during filtering, pagination, and refresh.
- Use loading indicators appropriate to the request.
- Respect reduced motion in skeletons and loading effects.
- Use a brief, restrained highlight when a record changes if useful.
- Show final metric values immediately.
- Do not animate numbers through invented intermediate values.
- Do not replay card entrances on background refresh.
- Do not animate every table row.

Motion must not imply healthy integration status, live activity,
or verified security results when the data does not support that claim.

Decorative Spline pulses represent branding, not operational telemetry.

### 17.8. Cyber Range Motion

Begin with the existing 2D segment view.

When a user selects an asset:

- Highlight the selected node.
- Emphasize its related connections.
- Show the corresponding details.
- Preserve the user's position and zoom.

Animate threat paths or packet movement only when their meaning is
defined and the source is clearly identified as live, recorded,
or simulated.

Custom interactive 3D topology remains a separate feature decision.
It is not required for this motion pass.

### 17.9. Future Scroll-Driven Landing Page

This subsection applies only if a separate public product landing page
is approved. It does not authorize creating that page now.

A proposed sequence could introduce:

1. The protected cybersecurity core.
2. Connected assets and vulnerability exposure.
3. Detection and incident response.
4. Governance, controls, and evidence.
5. A final demo or sign-in action.

Scrolling may reveal text and move the artwork between a small number
of deliberate compositions.

Requirements:

- Preserve normal browser scrolling.
- Do not hijack the scroll wheel.
- Do not require animation completion to access content.
- Keep content readable without 3D or JavaScript animation.
- Avoid long pinned sequences on smaller screens.
- Do not add scroll-driven camera movement to operational dashboards.

If the Spline export does not support the required scene control,
use restrained page-level transitions or document an alternative.
Do not promise scroll-linked 3D behavior before verifying support.

### 17.10. Reduced Motion and User Control

Honor `prefers-reduced-motion`.

With reduced motion enabled:

- Disable camera pushes, parallax, pointer tilt, and traveling pulses.
- Present the static scene.
- Replace sliding and scaling with immediate state changes or brief fades.
- Keep all information and actions available.

Provide a way to pause any ongoing decorative animation.
If an application motion preference is implemented, it must be able
to reduce motion beyond the operating-system setting.

### 17.11. Performance and Fallbacks

- Preserve the existing static artwork fallback.
- Keep the current desktop-only 3D loading rule unless explicitly revised.
- Do not introduce a second renderer for the same brand scene.
- Prefer transform and opacity for frontend movement.
- Avoid large animated blurs and expensive continuous effects.
- Reserve artwork dimensions to prevent layout shifts.
- Pause or unload unnecessary scene activity when it is offscreen
  or the browser tab is hidden, where supported.
- Verify behavior on the project's Intel MacBook Pro.
- Keep navigation and authentication usable if animation fails.

### 17.12. Implementation Order

Implement this as a separate, reviewable UI enhancement after the
current functional milestone is stable.

1. Inspect existing motion, Spline integration, and dependencies.
2. Establish shared timing and easing tokens.
3. Add button, sidebar, tab, and drawer transitions.
4. Add the welcome-page text entrance.
5. Refine the Spline camera and lighting in the editable scene.
6. Integrate the verified scene and static-to-live transition.
7. Add reduced-motion behavior and animation controls.
8. Verify performance, keyboard access, and existing workflows.

Do not change API contracts, authentication behavior, permissions,
or business logic as part of this motion pass.

Motion Phase 1 adds shared tokens only. They live in
`apps/web/src/styles/tokens.css` and `apps/web/src/lib/motion.ts`.
No animation library was added. Existing transitions, the Spline scene,
and the global reduced-motion rule are unchanged. The welcome sequence,
pointer tilt, and application animations remain proposed.

| Token | Value | Intended use |
|---|---|---|
| `--motion-duration-fast` | 150ms | Immediate control feedback |
| `--motion-duration-standard` | 200ms | Navigation, tabs, drawers, and dialogs |
| `--motion-duration-cinematic` | 400ms | Welcome copy and artwork crossfades |
| `--motion-ease-enter` | `cubic-bezier(0, 0, 0.2, 1)` | Ease-out entrances |
| `--motion-ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Ease-in exits |
| `--motion-distance` | 8px | Maximum subtle travel |

### 17.13. Acceptance Criteria

The motion pass is complete when:

- The approved visual design remains recognizable.
- Sign-in is usable immediately.
- Navigation and form input are not delayed.
- Tables and metrics remain stable.
- The Spline scene has a working static fallback.
- Reduced-motion preferences are respected.
- Ongoing decorative animation can be paused.
- Motion does not misrepresent security data.
- Existing functional checks still pass.
- Browser review confirms no clipping, layout shifts, or new errors.

Record which effects were implemented, which were verified,
and which remain proposed.