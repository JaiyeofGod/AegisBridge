/**
 * Current runtime: public Spline preview URL (iframe).
 *
 * Transparent background and branding-free embedding are controlled in the
 * Spline editor Play Settings, then published via Code/Viewer export — they
 * cannot be enabled from a cross-origin `my.spline.design` iframe alone.
 *
 * Recommended next step (official):
 * 1. Open https://app.spline.design/file/3c479e64-e72d-4925-be5a-adb8a87528b2
 * 2. Export → Play Settings:
 *    - BG Color: Hide (transparent canvas)
 *    - Logo: No (requires Hobby / Pro / Max)
 * 3. Export → Code → React and copy the `prod.spline.design/.../scene.splinecode` URL
 * 4. Set `SPLINE_SCENE_CODE_URL` below and switch `SignInSplineScene` to
 *    `@splinetool/react-spline` (or Spline Viewer web component).
 */
export const SPLINE_PUBLIC_SCENE_URL =
  "https://my.spline.design/aegisbridgecybersecurityscene-dRDuyGtdof1qLahfmB6r1TFz/";

/** Populated after Code export from Spline (not available yet in-repo). */
export const SPLINE_SCENE_CODE_URL: string | null = null;
