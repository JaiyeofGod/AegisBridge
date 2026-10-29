export type Box = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type Point = {
  x: number;
  y: number;
};

/** Point where a line toward `toward` meets the box boundary. */
export function anchorOnBox(box: Box, toward: Point): Point {
  const centerX = box.left + box.width / 2;
  const centerY = box.top + box.height / 2;
  const deltaX = toward.x - centerX;
  const deltaY = toward.y - centerY;
  if (deltaX === 0 && deltaY === 0) return { x: centerX, y: centerY };
  const halfWidth = Math.max(box.width, 0) / 2;
  const halfHeight = Math.max(box.height, 0) / 2;
  if (halfWidth === 0 && halfHeight === 0) return { x: centerX, y: centerY };
  const scaleX = halfWidth === 0 ? Number.POSITIVE_INFINITY : Math.abs(deltaX) / halfWidth;
  const scaleY = halfHeight === 0 ? Number.POSITIVE_INFINITY : Math.abs(deltaY) / halfHeight;
  const scale = 1 / Math.max(scaleX, scaleY);
  if (!Number.isFinite(scale)) return { x: centerX, y: centerY };
  return { x: centerX + deltaX * scale, y: centerY + deltaY * scale };
}

/**
 * Sideways shift that stays on the same side of a pair when the arrow is reversed.
 * The basis follows system-id order, not source to target.
 */
export function stableOffset(
  sourceId: string,
  targetId: string,
  source: Point,
  target: Point,
  offset: number,
): Point {
  if (offset === 0) return { x: 0, y: 0 };
  const forward = sourceId < targetId;
  const from = forward ? source : target;
  const to = forward ? target : source;
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const length = Math.hypot(deltaX, deltaY);
  if (length === 0) return { x: 0, y: 0 };
  const x = (-deltaY / length) * offset;
  const y = (deltaX / length) * offset;
  return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y };
}

export function offsetsForBundle(count: number, gap = 8): number[] {
  if (count <= 1) return [0];
  const origin = -((count - 1) * gap) / 2;
  return Array.from({ length: count }, (_, index) => origin + index * gap);
}

export function endpointPairKey(sourceId: string, targetId: string): string {
  return sourceId < targetId ? `${sourceId}\0${targetId}` : `${targetId}\0${sourceId}`;
}

export function boxCenter(box: Box): Point {
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}
