import "../shared.css";
import "./theme.css";
import type { Context } from "../../app/context";
import type { AppState } from "../../app/state";
import { createTickDial, onReading } from "../shared";

/** The part of the day an hour belongs to. */
function skyAt(hour: number): string {
  if (hour < 5 || hour >= 20) return "night";
  if (hour < 8) return "dawn";
  if (hour < 16) return "day";
  return "dusk";
}

/** Daylight: a light page under the sky of the hour, and a fine dial. */
export function mount(home: HTMLElement, context: Context, state: AppState): void {
  const dial = createTickDial();
  const gauge = home.querySelector(".gauge-power") as HTMLElement;
  gauge.classList.add("dialled");
  gauge.querySelector(".hero-number")?.before(dial.element);
  const hourOf = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: context.timezone });
  onReading(context, state, ({ share, ts }) => {
    dial.paint(share);
    document.documentElement.dataset.sky = skyAt(Number(hourOf.format(ts * 1000)));
  });
}
