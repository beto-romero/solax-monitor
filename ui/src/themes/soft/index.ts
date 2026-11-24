import "../shared.css";
import "./theme.css";
import type { Context } from "../../app/context";
import type { AppState } from "../../app/state";
import { createRing, onReading } from "../shared";

/** Soft: a moulded instrument. The ring of light shows the power delivered,
 * and its colour and calm are the plant's own. */
export function mount(home: HTMLElement, context: Context, state: AppState): void {
  const ring = createRing();
  const gauge = home.querySelector(".gauge-power") as HTMLElement;
  gauge.classList.add("dialled");
  gauge.querySelector(".hero-number")?.before(ring.element);
  onReading(context, state, ({ share }) => ring.paint(share));
}
