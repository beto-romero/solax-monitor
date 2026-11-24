import "./theme.css";
import type { Context } from "../../app/context";
import type { AppState } from "../../app/state";
import { createBank, createColumn, createReadout, createWave } from "./instruments";

/**
 * Command: a control room on an ordinary day. Structure is amber and figures
 * are green; red belongs to heat and faults alone, and takes over the panel
 * only when the plant's own verdict calls for it.
 */
export function mount(home: HTMLElement, context: Context, state: AppState): void {
  const find = (selector: string) => home.querySelector(selector) as HTMLElement;
  const temperature = context.registry.metrics.find((metric) => metric.section === "inverter" && metric.unit === "C");
  const frequency = context.registry.metrics.find((metric) => metric.unit === "Hz");

  const readout = createReadout(Math.max(4, String(context.limitWatts).length));
  find(".gauge-power .hero-number").prepend(readout.element);
  const bank = createBank();
  find(".gauge-power .meter").after(bank.element);
  const column = createColumn();
  if (temperature) find(".gauge-heat").append(column.element);
  const wave = createWave();
  if (frequency) home.querySelector(".sections")?.prepend(wave.element);

  const paint = () => {
    const reading = state.now?.reading;
    if (!reading) return;
    const number = (key: string | undefined) => {
      const value = key === undefined ? null : reading.values[key];
      return typeof value === "number" ? value : null;
    };
    readout.paint(number(context.hero.key));
    const delivered = number(context.limitMetric.key) ?? 0;
    bank.paint(context.limitWatts > 0 ? delivered / context.limitWatts : 0);
    column.paint(number(temperature?.key));
    wave.paint(number(frequency?.key));
  };
  state.subscribe(paint);
  paint();
}
