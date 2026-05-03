import { describe, expect, it } from "vitest";
import { parseHierarchyGrantBaseCredits } from "./hierarchyGrantRemark";

describe("parseHierarchyGrantBaseCredits", () => {
  it("parses base from unified grant remark", () => {
    expect(parseHierarchyGrantBaseCredits("115 credits received by admin (base 100)")).toBe(100);
  });

  it("does not treat (base 1000) as (base 100)", () => {
    expect(parseHierarchyGrantBaseCredits("1100 credits received by x (base 1000)")).toBe(1000);
    expect(parseHierarchyGrantBaseCredits("150 credits received by x (base 100)")).toBe(100);
  });

  it("returns null when marker missing", () => {
    expect(parseHierarchyGrantBaseCredits("100 credits received by admin")).toBeNull();
  });
});
