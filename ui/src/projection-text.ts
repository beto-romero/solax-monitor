import type { Projection } from "./api/bindings";
import { formatNumber } from "./format";

/** The line under today's yield, kept short, and the words its info button
 * shows on how the figure is reached. */
export interface ProjectionLine {
  text: string;
  tip: string;
}

/** The days the projection needs before it says anything. */
const MINIMUM_DAYS = 3;

/** The line about where today ends, or null when it hides. Today's yield
 * above it runs live, so the line names the end of the day. */
export function projectionLine(projection: Projection, decimals: number, unit: string, locale?: string): ProjectionLine | null {
  switch (projection.state) {
    case "not_enough_history":
      return {
        text: `Estimate after ${MINIMUM_DAYS} full days`,
        tip: `Today's total is estimated from how recent full days went. It needs ${MINIMUM_DAYS} full days recorded to start.`,
      };
    case "too_early":
      return projection.from
        ? {
            text: "Estimate from about " + projection.from,
            tip: "Today's total is estimated from how recent full days went, once the morning has made enough to go on.",
          }
        : null;
    case "on_pace": {
      const figure = (value: number) => formatNumber(value, decimals, locale);
      const days = projection.based_on_days;
      return {
        text: `≈ ${figure(projection.expected_kwh)} ${unit} by end of day`,
        tip: `Based on how the last ${days} full ${days === 1 ? "day" : "days"} went. Likely between ${figure(projection.low_kwh)} and ${figure(projection.high_kwh)} ${unit}.`,
      };
    }
    case "finished":
      return null;
  }
}
