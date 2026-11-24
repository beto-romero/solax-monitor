import type uPlot from "uplot";
import type { Stretches } from "../api/bindings";
import { formatNumber, timeOfDay, unitLabel } from "../format";
import { seriesName, type Pane } from "./panes";

export interface TooltipOptions {
  timezone: string;
  stretches(): Stretches | null;
}

function within(stretches: Array<[number, number]> | undefined, ts: number): boolean {
  return (stretches ?? []).some(([from, to]) => ts >= from && ts <= to);
}

/**
 * What the crosshair is over: the time, each line shown, and whether the
 * inverter was held back then. The crosshair is shared, so the charts answer
 * together and power can be read straight against temperature.
 */
export function tooltipPlugin(pane: Pane, options: TooltipOptions): uPlot.Plugin {
  const tip = document.createElement("div");
  tip.className = "chart-tip";
  tip.hidden = true;

  const row = (colour: string, name: string, value: string) => {
    const line = document.createElement("div");
    line.className = "tip-row";
    const key = document.createElement("span");
    key.className = "tip-key";
    key.style.background = colour;
    const amount = document.createElement("span");
    amount.className = "tip-value";
    amount.textContent = value;
    line.append(key, name, amount);
    return line;
  };

  const note = (text: string, kind: string) => {
    const line = document.createElement("div");
    line.className = "tip-note " + kind;
    line.textContent = text;
    return line;
  };

  return {
    hooks: {
      init: (chart) => {
        chart.over.appendChild(tip);
      },
      setCursor: (chart) => {
        const { idx, left } = chart.cursor;
        if (idx === null || idx === undefined || left === undefined || left < 0) {
          tip.hidden = true;
          return;
        }
        const ts = chart.data[0][idx];
        const time = document.createElement("div");
        time.className = "tip-time";
        time.textContent = timeOfDay(ts, options.timezone);
        const lines: HTMLElement[] = [time];
        pane.metrics.forEach((metric, position) => {
          if (!chart.series[position + 1].show) return;
          const value = chart.data[position + 1]?.[idx];
          if (value === null || value === undefined) return;
          lines.push(row(pane.colours[position], seriesName(metric), formatNumber(value, metric.decimals) + " " + unitLabel(metric.unit)));
        });
        const stretches = options.stretches();
        if (within(stretches?.derating, ts)) lines.push(note("Heat derating", "heat"));
        else if (within(stretches?.at_limit, ts)) lines.push(note("At the inverter's limit", "limit"));
        tip.replaceChildren(...lines);
        tip.hidden = false;
        // Beside the crosshair, on whichever side has the room.
        const room = chart.over.clientWidth;
        const offset = left + 14 + tip.offsetWidth > room ? left - 14 - tip.offsetWidth : left + 14;
        tip.style.left = Math.max(0, offset) + "px";
      },
    },
  };
}
