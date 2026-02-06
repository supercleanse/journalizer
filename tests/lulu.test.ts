import { describe, it, expect } from "vitest";
import { getPodPackageId, getRetailPriceCents } from "../src/services/lulu";

describe("getPodPackageId", () => {
  it("returns 5.5x8.5 BW for weekly bw", () => {
    expect(getPodPackageId("weekly", "bw")).toBe("0550X0850BWSTDPB060UW444MXX");
  });

  it("returns 5.5x8.5 FC for weekly color", () => {
    expect(getPodPackageId("weekly", "color")).toBe("0550X0850FCSTDPB060UW444MXX");
  });

  it("returns 6x9 BW for monthly bw", () => {
    expect(getPodPackageId("monthly", "bw")).toBe("0600X0900BWSTDPB060UW444MXX");
  });

  it("returns 6x9 FC for monthly color", () => {
    expect(getPodPackageId("monthly", "color")).toBe("0600X0900FCSTDPB080CW444GXX");
  });

  it("returns 6x9 for quarterly and yearly", () => {
    expect(getPodPackageId("quarterly", "bw")).toBe("0600X0900BWSTDPB060UW444MXX");
    expect(getPodPackageId("yearly", "bw")).toBe("0600X0900BWSTDPB060UW444MXX");
  });
});

describe("getRetailPriceCents", () => {
  it("returns fixed price for weekly", () => {
    expect(getRetailPriceCents("weekly", 700)).toBe(1299);
  });

  it("returns fixed price for monthly", () => {
    expect(getRetailPriceCents("monthly", 1000)).toBe(1799);
  });

  it("returns fixed price for quarterly", () => {
    expect(getRetailPriceCents("quarterly", 1400)).toBe(2499);
  });

  it("returns fixed price for yearly", () => {
    expect(getRetailPriceCents("yearly", 2600)).toBe(3999);
  });

  it("returns calculated price for unknown frequency", () => {
    // 500 cents * 2 = 1000, ceil to 1000, -1 = 999
    expect(getRetailPriceCents("custom", 500)).toBe(999);
  });
});
