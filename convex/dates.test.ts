import { describe, expect, it } from "vitest";
import { addMonths } from "./dates";

describe("addMonths", () => {
  it("ucina do końca krótszego miesiąca i przechodzi przez rok", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-11-15", 6)).toBe("2027-05-15");
    expect(addMonths("2026-12-31", 12)).toBe("2027-12-31");
  });
});
