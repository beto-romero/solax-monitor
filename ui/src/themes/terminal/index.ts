import "../shared.css";
import "./theme.css";
import type { Context } from "../../app/context";
import type { AppState } from "../../app/state";
import { onReading } from "../shared";
import { asciiBar, createBanner } from "./ascii";

function bar(): HTMLElement {
  const element = document.createElement("div");
  element.className = "text-bar";
  element.setAttribute("aria-hidden", "true");
  return element;
}

/** Terminal: a text-mode screen in sixteen colours, with the power spelled
 * out in ASCII art. */
export function mount(home: HTMLElement, context: Context, state: AppState): void {
  const banner = createBanner(Math.max(4, String(context.limitWatts).length));
  home.querySelector(".gauge-power .hero-number")?.prepend(banner.element);
  const power = bar();
  home.querySelector(".gauge-power .meter")?.after(power);
  const heat = bar();
  home.querySelector(".gauge-heat .gauge-value")?.after(heat);
  onReading(context, state, ({ watts, share, degrees }) => {
    banner.paint(watts);
    power.textContent = asciiBar(share, 46);
    // A plain 0 to 100 scale: the inverter sends no limit of its own.
    heat.textContent = asciiBar((degrees ?? 0) / 100, 20);
  });
}
