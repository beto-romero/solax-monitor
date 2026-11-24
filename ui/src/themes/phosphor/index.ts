import "../shared.css";
import "./theme.css";
import type { Context } from "../../app/context";
import type { AppState } from "../../app/state";
import { createNeedle, onReading } from "../shared";

/** Phosphor: a bench oscilloscope. One glowing ink, a ruled screen, and a
 * needle for the power delivered. */
export function mount(home: HTMLElement, context: Context, state: AppState): void {
  const needle = createNeedle(context.limitWatts);
  home.querySelector(".gauge-power .hero-number")?.after(needle.element);
  onReading(context, state, ({ share }) => needle.paint(share));
}
