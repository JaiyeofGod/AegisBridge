const MAX_SHIFT_PX = 6;
const MAX_TILT_DEG = 1;

export type ArtworkRect = Pick<DOMRect, "left" | "top" | "width" | "height">;

export type ArtworkParallax = {
  x: string;
  y: string;
  rx: string;
  ry: string;
};

function clampUnit(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

/** Pointer offset inside the artwork box, limited to 6px and 1 degree. */
export function artworkParallax(
  clientX: number,
  clientY: number,
  rect: ArtworkRect,
): ArtworkParallax | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const px = clampUnit(((clientX - rect.left) / rect.width - 0.5) * 2);
  const py = clampUnit(((clientY - rect.top) / rect.height - 0.5) * 2);
  return {
    x: `${(px * MAX_SHIFT_PX).toFixed(2)}px`,
    y: `${(py * MAX_SHIFT_PX).toFixed(2)}px`,
    rx: `${(-py * MAX_TILT_DEG).toFixed(2)}deg`,
    ry: `${(px * MAX_TILT_DEG).toFixed(2)}deg`,
  };
}

export const artworkParallaxRest: ArtworkParallax = {
  x: "0px",
  y: "0px",
  rx: "0deg",
  ry: "0deg",
};
