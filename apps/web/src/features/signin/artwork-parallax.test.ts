import { describe, expect, it } from "vitest";

import { artworkParallax } from "@/features/signin/artwork-parallax";

const rect = { left: 0, top: 0, width: 200, height: 100 };

describe("artworkParallax", () => {
  it("stays inside 6px and 1 degree", () => {
    expect(artworkParallax(0, 0, rect)).toEqual({
      x: "-6.00px",
      y: "-6.00px",
      rx: "1.00deg",
      ry: "-1.00deg",
    });
    expect(artworkParallax(200, 100, rect)).toEqual({
      x: "6.00px",
      y: "6.00px",
      rx: "-1.00deg",
      ry: "1.00deg",
    });
    expect(artworkParallax(100, 50, rect)).toEqual({
      x: "0.00px",
      y: "0.00px",
      rx: "0.00deg",
      ry: "0.00deg",
    });
  });

  it("ignores a box with no size", () => {
    expect(artworkParallax(10, 10, { left: 0, top: 0, width: 0, height: 40 })).toBeNull();
  });
});
