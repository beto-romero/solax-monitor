import type { Metric, Now } from "../api/bindings";
import type { Context } from "../app/context";
import { SECTION_TITLES } from "../charts/panes";
import { formatDuration, formatNumber } from "../format";

const SECTION_ORDER = ["solar", "grid", "inverter"];

// Not registry driven, and deliberately so: these describe the device and
// the store rather than a reading.
const SYSTEM_ROWS: Array<[string, string]> = [
  ["inverter_serial", "Inverter"],
  ["firmware", "Firmware"],
  ["api_type", "API type"],
  ["poll_interval", "Polling every"],
];

/** One row of a card: the live value and, for a metric with a peak, today's
 * peak in gold after it, reading as "240.0 V / 260.0 V". */
function statRow(metric: Metric): HTMLElement {
  const row = document.createElement("div");
  row.className = "stat";
  row.dataset.metric = metric.key;
  const label = document.createElement("span");
  label.className = "name";
  label.textContent = metric.label;
  if (metric.note) {
    const note = document.createElement("span");
    note.className = "note";
    note.textContent = metric.note;
    label.appendChild(note);
  }
  const unit = metric.unit ? '<span class="unit">' + metric.unit + "</span>" : "";
  const reading = document.createElement("span");
  reading.className = "reading";
  reading.innerHTML =
    '<span class="live">–' + unit + "</span>" + (metric.peak ? '<span class="sep">/</span><span class="top">–' + unit + "</span>" : "");
  row.append(label, reading);
  return row;
}

/** Today's heat derating as the Inverter card shows it, or null when the
 * metrics that show it are not named. */
export function derateReading(count: number | null, seconds: number | null): string | null {
  // A server that predates the figure leaves it out, so undefined too.
  if (count == null) return null;
  if (count === 0) return "None";
  return `${count} ${count === 1 ? "time" : "times"}, ${formatDuration(seconds ?? 0)}`;
}

function sectionCard(name: string, title: string): HTMLElement {
  const card = document.createElement("section");
  card.className = "card";
  const heading = document.createElement("h2");
  heading.className = "section-title " + name;
  heading.textContent = title;
  card.appendChild(heading);
  return card;
}

function paintSerialToggle(button: HTMLButtonElement, shown: boolean): void {
  button.innerHTML = shown
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a15.7 15.7 0 0 1-3.1 3.8M6.2 6.3C3.5 8.1 2 12 2 12s3.6 7 10 7a10 10 0 0 0 4-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  const action = shown ? "Hide" : "Show";
  button.setAttribute("aria-pressed", String(shown));
  button.setAttribute("aria-label", `${action} inverter number`);
  button.title = `${action} inverter number`;
}

export interface Cards {
  readonly element: HTMLElement;
  paint(now: Now | null): void;
}

/** The Solar, Grid and Inverter cards, a row per metric not already on the
 * hero card, and the System card. Live values, today's peaks in gold, and
 * the run mode row tinted with the inverter's own verdict. */
export function createCards(context: Context): Cards {
  const element = document.createElement("section");
  element.className = "sections loading";

  const bySection = new Map<string, Metric[]>();
  for (const metric of context.registry.metrics) {
    // Featured metrics ride on the hero card, and so does the grid
    // countdown, which reads zero most of the day.
    if (metric.feature || metric.key === context.gridCountdown?.key) continue;
    if (!bySection.has(metric.section)) bySection.set(metric.section, []);
    bySection.get(metric.section)!.push(metric);
  }
  const rows = new Map<string, HTMLElement>();
  const names = [...bySection.keys()].sort((first, second) => (SECTION_ORDER.indexOf(first) + 1 || 99) - (SECTION_ORDER.indexOf(second) + 1 || 99));
  // Today's heat derating sits with the inverter's own readings. The
  // inverter never reports it; the server reads it from them.
  const derateRow = document.createElement("div");
  derateRow.className = "stat";
  derateRow.dataset.derived = "heat_derating";
  derateRow.hidden = true;
  derateRow.innerHTML = '<span class="name">Heat derating today</span><span class="reading"><span class="live">–</span></span>';
  const derateValue = derateRow.querySelector(".live") as HTMLElement;
  for (const name of names) {
    const card = sectionCard(name, SECTION_TITLES[name] ?? name);
    for (const metric of bySection.get(name)!) {
      const row = statRow(metric);
      rows.set(metric.key, row);
      card.appendChild(row);
    }
    if (name === "inverter") card.appendChild(derateRow);
    element.appendChild(card);
  }
  const systemCard = sectionCard("system", "System");
  systemCard.id = "system-card";
  const systemValues = new Map<string, HTMLElement>();
  let showInverterNumber = false;
  try {
    showInverterNumber = localStorage.getItem("solax.show-inverter-number") === "true";
  } catch {
    // The control works for the current page even when storage is blocked.
  }
  for (const [key, label] of SYSTEM_ROWS) {
    const row = document.createElement("div");
    row.className = "stat";
    row.dataset.system = key;
    row.innerHTML = '<span class="name"></span><span class="reading"><span class="live">–</span></span>';
    row.querySelector(".name")!.textContent = label;
    systemValues.set(key, row.querySelector(".live") as HTMLElement);
    if (key === "inverter_serial") {
      const value = systemValues.get(key)!;
      value.textContent = showInverterNumber ? (context.registry.site.inverter_serial || "unknown") : "";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "serial-toggle";
      paintSerialToggle(toggle, showInverterNumber);
      toggle.addEventListener("click", () => {
        showInverterNumber = !showInverterNumber;
        value.textContent = showInverterNumber ? (context.registry.site.inverter_serial || "unknown") : "";
        paintSerialToggle(toggle, showInverterNumber);
        try {
          localStorage.setItem("solax.show-inverter-number", String(showInverterNumber));
        } catch {
          // The current view still updates if persistence is unavailable.
        }
        const subtitle = document.getElementById("subtitle");
        if (subtitle && document.documentElement.dataset.demo !== "true") {
          subtitle.textContent = showInverterNumber && context.registry.site.inverter_serial
            ? context.registry.site.inverter_serial + " on your local network"
            : "Inverter on your local network";
        }
      });
      row.querySelector(".name")!.appendChild(toggle);
    }
    systemCard.appendChild(row);
  }
  element.appendChild(systemCard);
  if (showInverterNumber && document.documentElement.dataset.demo !== "true") {
    const subtitle = document.getElementById("subtitle");
    if (subtitle && context.registry.site.inverter_serial) subtitle.textContent = context.registry.site.inverter_serial + " on your local network";
  } else if (document.documentElement.dataset.demo !== "true") {
    const subtitle = document.getElementById("subtitle");
    if (subtitle) subtitle.textContent = "Inverter on your local network";
  }
  systemValues.get("poll_interval")!.textContent = context.intervalSeconds + " s";

  return {
    element,
    paint(now) {
      const reading = now?.reading;
      if (!now || !reading) return;
      element.classList.remove("loading");
      for (const metric of context.registry.metrics) {
        const row = rows.get(metric.key);
        if (!row) continue;
        (row.querySelector(".reading .live")!.firstChild as Text).nodeValue = formatNumber(reading.values[metric.key], metric.decimals);
        const top = row.querySelector(".reading .top");
        // A null peak is painted too, as a dash, so a new day never shows
        // the previous day's figure.
        if (top && metric.key in now.peaks) (top.firstChild as Text).nodeValue = formatNumber(now.peaks[metric.key], metric.decimals);
      }
      const derating = derateReading(now.today.derate_count, now.today.derate_seconds);
      derateRow.hidden = derating === null;
      derateValue.textContent = derating ?? "–";
      const runMode = rows.get(context.runMode.key);
      const severity = reading.health.severity;
      runMode?.classList.toggle("fault", severity === "fault");
      runMode?.classList.toggle("warn", severity === "warn");
      systemValues.get("firmware")!.textContent = reading.device.ver ?? "–";
      systemValues.get("api_type")!.textContent = reading.device.inverter_type === null ? "–" : String(reading.device.inverter_type);
    },
  };
}
