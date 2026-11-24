import type { Context } from "../app/context";
import type { AppState } from "../app/state";

// Drawn instruments the themes share. Each repeats a figure the page already
// states in words, so all of them are hidden from assistive technology.

const SVG = "http://www.w3.org/2000/svg";

export function svg(tag: string, attributes: Record<string, string | number>): SVGElement {
  const element = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

export interface Figures {
  /** The power the panels give, in watts. */
  watts: number | null;
  /** The share of the inverter's limit being delivered, 0 to 1. */
  share: number;
  degrees: number | null;
  /** Epoch seconds of the reading. */
  ts: number;
}

/** Calls back with the figures of each reading. */
export function onReading(context: Context, state: AppState, paint: (figures: Figures) => void): void {
  const temperature = context.registry.metrics.find((metric) => metric.section === "inverter" && metric.unit === "C");
  const update = () => {
    const reading = state.now?.reading;
    if (!reading) return;
    const number = (key: string | undefined) => {
      const value = key === undefined ? null : reading.values[key];
      return typeof value === "number" ? value : null;
    };
    const delivered = number(context.limitMetric.key) ?? 0;
    paint({
      watts: number(context.hero.key),
      share: context.limitWatts > 0 ? Math.max(0, Math.min(1, delivered / context.limitWatts)) : 0,
      degrees: number(temperature?.key),
      ts: reading.ts,
    });
  };
  state.subscribe(update);
  update();
}

/** Today's readings of the hero metric, or null while another day is shown. */
export function heroToday(context: Context, state: AppState): { timestamps: number[]; values: Array<number | null> } | null {
  const day = state.day;
  if (!day || day.date !== state.today.today) return null;
  return { timestamps: day.timestamps, values: day.column(context.hero.key) };
}

function point(angle: number, radius: number): [number, number] {
  return [110 + Math.cos(angle) * radius, 110 + Math.sin(angle) * radius];
}

/** An arc of fine ticks, lit up to the share of the limit. */
export function createTickDial(ticks = 61) {
  const element = svg("svg", { class: "dial tick-dial", viewBox: "0 0 220 150", "aria-hidden": "true" });
  const start = Math.PI * 0.92;
  const sweep = Math.PI * 1.16;
  const lines = Array.from({ length: ticks }, (_, index) => {
    const angle = start + (index / (ticks - 1)) * sweep;
    const [x1, y1] = point(angle, index % 10 === 0 ? 88 : 93);
    const [x2, y2] = point(angle, 104);
    return element.appendChild(svg("line", { x1, y1, x2, y2 }));
  });
  return {
    element,
    paint(share: number) {
      const last = Math.round(share * (ticks - 1));
      lines.forEach((line, index) => {
        line.classList.toggle("lit", index <= last && share > 0);
        line.classList.toggle("tip", index === last && share > 0);
      });
    },
  };
}

/** A ring of light, filled to the share of the limit. */
export function createRing() {
  const element = svg("svg", { class: "dial ring", viewBox: "0 0 220 220", "aria-hidden": "true" });
  element.innerHTML =
    '<defs><linearGradient id="ring-light" x1="0" y1="1" x2="1" y2="0"><stop offset="0" class="ring-from"/><stop offset="1" class="ring-to"/></linearGradient></defs>';
  const common = { cx: 110, cy: 110, r: 86, fill: "none", pathLength: 100 };
  element.append(svg("circle", { ...common, class: "ring-track" }));
  const fill = element.appendChild(svg("circle", { ...common, class: "ring-fill", transform: "rotate(-90 110 110)", stroke: "url(#ring-light)" }));
  return {
    element,
    paint(share: number) {
      fill.setAttribute("stroke-dasharray", `${(share * 100).toFixed(1)} 100`);
      fill.classList.toggle("empty", share < 0.005);
    },
  };
}

/** A meter with a needle, over a scale marked with the limit in kilowatts. */
export function createNeedle(limitWatts: number) {
  const element = svg("svg", { class: "needle", viewBox: "0 0 240 120", "aria-hidden": "true" });
  const angleOf = (share: number) => Math.PI * (1.17 + share * 0.66);
  const at = (share: number, radius: number): [number, number] => {
    const angle = angleOf(share);
    return [120 + Math.cos(angle) * radius, 128 + Math.sin(angle) * radius];
  };
  for (let index = 0; index <= 20; index++) {
    const major = index % 5 === 0;
    const [x1, y1] = at(index / 20, major ? 88 : 94);
    const [x2, y2] = at(index / 20, 102);
    element.append(svg("line", { x1, y1, x2, y2, class: major ? "mark major" : "mark" }));
    if (!major) continue;
    const [x, y] = at(index / 20, 112);
    const label = svg("text", { x, y, "text-anchor": "middle" });
    label.textContent = ((limitWatts / 1000) * (index / 20)).toFixed(1);
    element.append(label);
  }
  const hand = element.appendChild(svg("line", { x1: 120, y1: 118, x2: 120, y2: 34, class: "hand" }));
  return {
    element,
    paint(share: number) {
      hand.setAttribute("transform", `rotate(${(-59.4 + share * 118.8).toFixed(1)} 120 128)`);
    },
  };
}
