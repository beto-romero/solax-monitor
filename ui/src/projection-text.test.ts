import { expect, test } from "vitest";
import { projectionLine } from "./projection-text";

test("each state reads short, with how it is estimated in the tip", () => {
  expect(projectionLine({ state: "not_enough_history", days: 2 }, 1, "kWh")?.text).toBe("Estimate after 3 full days");
  expect(projectionLine({ state: "too_early", from: "08:30" }, 1, "kWh")?.text).toBe("Estimate from about 08:30");
  expect(
    projectionLine({ state: "on_pace", expected_kwh: 15, low_kwh: 13.6, high_kwh: 16.7, based_on_days: 14 }, 1, "kWh", "en-US"),
  ).toEqual({ text: "≈ 15.0 kWh by end of day", tip: "Based on how the last 14 full days went. Likely between 13.6 and 16.7 kWh." });
  expect(projectionLine({ state: "finished", yield_kwh: 19.5 }, 1, "kWh")).toBeNull();
});

test("a too early projection without a time hides the line", () => {
  expect(projectionLine({ state: "too_early", from: null }, 1, "kWh")).toBeNull();
});
