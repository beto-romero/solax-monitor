import "../shared.css";
import "./theme.css";
import type { Context } from "../../app/context";
import type { AppState } from "../../app/state";
import { onReading } from "../shared";

const LAMPS = 16;

/**
 * Bridge: a flight deck of rounded colour blocks. The rails on the cards are
 * colour alone; the lamps count the power delivered against the limit.
 */
export function mount(home: HTMLElement, context: Context, state: AppState): void {
  const lamps = document.createElement("div");
  lamps.className = "lamps";
  lamps.setAttribute("aria-hidden", "true");
  const list = Array.from({ length: LAMPS }, () => lamps.appendChild(document.createElement("i")));
  home.querySelector(".gauge-power .meter")?.after(lamps);
  onReading(context, state, ({ share }) => {
    const lit = Math.round(share * LAMPS);
    list.forEach((lamp, index) => lamp.classList.toggle("lit", index < lit));
  });
}
