import type { DaySummary, Metric, Projection } from "../api/bindings";
import type { Context } from "../app/context";
import type { Controller } from "../app/controller";
import { statusOf, type Status } from "../app/shell";
import type { AppState } from "../app/state";
import { DayChart } from "../charts/day-chart";
import { ChartGroup } from "../charts/group";
import { createLegend } from "../charts/legend";
import { buildPanes, seriesShown, type Pane } from "../charts/panes";
import { chartHeights } from "../charts/sizing";
import { formatDuration, formatNumber, timeOfDay, unitLabel } from "../format";
import { pathKey, projectionPath } from "../projection-path";
import { projectionLine, type ProjectionLine } from "../projection-text";
import { createCards } from "./cards";
import { createDayNav } from "./day-nav";
import type { Screen } from "./screen";

export interface HeroLineOptions { decimals: number; unit: string; heroUnit: string; timezone: string; locale?: string }

/** The heat gauge's line on today's derating, said only when there was
 * some: a short line with the counts, and a tip that puts it in words. */
export function heatLine(count: number | null, seconds: number | null): ProjectionLine | null {
  if (!count) return null;
  const duration = formatDuration(seconds ?? 0);
  return {
    text: `Slowed by heat ${count}\u00d7 \u00b7 ${duration}`,
    tip: `The inverter lowered its output to cool down. Today it did so ${count} ${count === 1 ? "time" : "times"}, ${duration} in total.`,
  };
}

/** The hero card's two words-only lines: the projection and today's peak. */
export function heroLines(
  today: Pick<DaySummary, "yield_kwh" | "peak_power_w" | "peak_at">,
  projection: Projection,
  options: HeroLineOptions,
): { projection: ProjectionLine | null; peak: string | null } {
  const peak =
    today.peak_power_w !== null && today.peak_at !== null
      ? `Peak today ${formatNumber(today.peak_power_w, 0, options.locale)} ${options.heroUnit} at ${timeOfDay(today.peak_at, options.timezone, options.locale)}`
      : null;
  return { projection: projectionLine(projection, options.decimals, options.unit, options.locale), peak };
}

/** The words under the meter: the seconds left before the inverter feeds
 * the grid while it counts them down, then how close the power is to the
 * most the inverter delivers. */
export function meterCaption(watts: number, limitWatts: number, countdownSeconds: number | null): string {
  if (countdownSeconds !== null && countdownSeconds > 0) return `Connecting to the grid in ${countdownSeconds} s`;
  const fraction = limitWatts > 0 ? watts / limitWatts : 0;
  if (fraction < 0.02) return "Idle";
  if (fraction >= 0.97) return "At the inverter's limit";
  return Math.round(fraction * 100) + "% of the inverter's limit";
}

export interface VerdictInput {
  status: Status;
  severity: string | null;
  runMode: string | null;
  watts: number;
  limitWatts: number;
  countdownSeconds: number | null;
  deratingNow: boolean;
  deratesToday: number | null;
  faultReadingsToday: number;
}

export interface Verdict {
  tone: "good" | "limit" | "heat" | "watch" | "fault" | "idle";
  title: string;
  detail: string;
}

/** What today has been like, for the words under a calm verdict. */
function dayInWords(deratesToday: number | null, faultReadingsToday: number): string {
  if (faultReadingsToday > 0) return "Faults were reported earlier today";
  if (deratesToday) return `Stepped down for heat ${deratesToday} ${deratesToday === 1 ? "time" : "times"} today`;
  return deratesToday === 0 ? "No faults or heat derating today" : "No faults today";
}

/**
 * The one sentence that says how the plant is doing, worst news first: a
 * fault, then silence, sleep, the morning's connection, heat, the limit, and
 * only then all being well.
 */
export function verdictOf(input: VerdictInput): Verdict {
  const day = dayInWords(input.deratesToday, input.faultReadingsToday);
  const fraction = input.limitWatts > 0 ? input.watts / input.limitWatts : 0;
  if (input.severity === "fault") return { tone: "fault", title: input.runMode ?? "Fault", detail: "The inverter reports a fault" };
  if (input.status.kind === "stale") return { tone: "watch", title: input.status.text, detail: "These are the last figures received" };
  if (input.severity === "warn") return { tone: "watch", title: input.runMode ?? "Check the inverter", detail: day };
  if (input.status.kind === "asleep") return { tone: "idle", title: input.status.text, detail: day };
  if (input.countdownSeconds !== null && input.countdownSeconds > 0) {
    return { tone: "idle", title: `Connecting to the grid in ${input.countdownSeconds} s`, detail: day };
  }
  if (input.deratingNow) return { tone: "heat", title: "Held back by heat", detail: "The inverter stepped its output down to cool off" };
  if (fraction >= 0.97) return { tone: "limit", title: "At the inverter's limit", detail: "The panels could give more than it delivers" };
  if (fraction < 0.02) return { tone: "idle", title: "Not producing", detail: day };
  return { tone: "good", title: "Producing normally", detail: day };
}

/** Which chart sits under the power chart, remembered per device. */
const COMPANION_STORAGE_KEY = "solax.companion-chart.v2";

function rememberedCompanion(): string | null {
  try {
    return localStorage.getItem(COMPANION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberCompanion(name: string): void {
  try {
    localStorage.setItem(COMPANION_STORAGE_KEY, name);
  } catch {
    // Remembering the choice is a convenience; the switch itself still works.
  }
}

/** An element's height with its vertical margins. */
function boxHeight(element: Element | null): number {
  if (!(element instanceof HTMLElement)) return 0;
  const style = getComputedStyle(element);
  return element.offsetHeight + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
}

const MARKUP = `
  <section class="card hero loading">
    <div class="verdict" data-tone="idle">
      <span class="verdict-mark"></span>
      <div class="verdict-words">
        <h2 class="verdict-title">Waiting for the first reading</h2>
        <p class="verdict-detail"></p>
      </div>
      <span class="updated-group">
        <span class="tick"></span>
        <span id="updated">no reading yet</span>
      </span>
    </div>
    <div class="gauges">
      <div class="gauge gauge-power">
        <p class="gauge-label">Producing now</p>
        <div class="hero-number">
          <span id="hero-value">–</span><span class="hero-unit"></span>
        </div>
        <div class="meter"><div class="meter-fill"></div></div>
        <p class="muted meter-caption">Waiting for the first reading.</p>
      </div>
      <div class="gauge gauge-today">
        <div class="hero-extras"></div>
        <p class="hero-line info-line projection-line" hidden>
          <span class="info-text"></span>
          <span class="info-tip">
            <button type="button" class="info-button" aria-label="How this is estimated" aria-expanded="false" aria-describedby="projection-tip">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </button>
          </span>
          <span class="info-bubble" id="projection-tip" role="tooltip"></span>
        </p>
        <p class="hero-line peak-line" hidden></p>
      </div>
      <div class="gauge gauge-heat" hidden>
        <p class="gauge-label">Inverter temperature</p>
        <p class="gauge-value"><span class="heat-value">–</span><span class="unit"></span></p>
        <p class="hero-line heat-peak" hidden></p>
        <p class="hero-line info-line heat-derating alert-heat" hidden>
          <span class="info-text"></span>
          <span class="info-tip">
            <button type="button" class="info-button" aria-label="What this means" aria-expanded="false" aria-describedby="heat-tip">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </button>
          </span>
          <span class="info-bubble" id="heat-tip" role="tooltip"></span>
        </p>
      </div>
    </div>
  </section>
  <section class="card chart-card">
    <div class="card-head">
      <h2 class="chart-title">Power</h2>
      <div class="legend main-legend"></div>
    </div>
    <div id="chart"></div>
    <div class="chart-key" hidden>
      <span class="key derating">Heat derating</span>
      <span class="key at-limit">At the inverter's limit</span>
    </div>
    <div class="card-head companion-head">
      <div class="chart-tabs" role="group" aria-label="Second chart"></div>
      <div class="legend companion-legend"></div>
    </div>
    <div id="companion-chart"></div>
    <p class="muted chart-note">Loading today's readings.</p>
  </section>
`;

/**
 * Everything about the present day on one screen: the hero card, the power
 * chart with the second chart directly under it, read against each other on
 * one time axis, and the Solar, Grid, Inverter and System cards. On a phone
 * they stack, the first screen holding the hero and the power chart; on a
 * wide screen the readings and the charts sit side by side and fill it.
 */
export function createHome(context: Context, state: AppState, controller: Controller): Screen {
  const element = document.createElement("section");
  element.className = "screen";
  element.dataset.screen = "home";
  element.hidden = true;
  element.innerHTML = MARKUP;
  const find = <Found extends HTMLElement>(selector: string) => element.querySelector(selector) as Found;

  const hero = context.hero;
  const panes = buildPanes(context.registry.metrics, hero.key);
  const pane = panes.main;
  // Temperature explains the power chart, so it comes first under it.
  const heat = context.registry.metrics.find((metric) => metric.section === "inverter" && metric.unit === "C") ?? null;
  const companions = [...panes.others].sort((first, second) => Number(second.metrics.includes(heat!)) - Number(first.metrics.includes(heat!)));
  const featured = context.registry.metrics.filter((metric) => metric.feature);
  const heroCard = find(".hero");
  const heroValue = find("#hero-value");
  const updated = find("#updated");
  const updatedGroup = find(".updated-group");
  const verdictBox = find(".verdict");
  const verdictTitle = find(".verdict-title");
  const verdictDetail = find(".verdict-detail");
  const heatGauge = find(".gauge-heat");
  const heatValue = find(".heat-value");
  const heatPeak = find(".heat-peak");
  const heatDerating = find(".heat-derating");
  const meter = find(".meter-fill");
  const caption = find(".meter-caption");
  const projectionText = find(".projection-line");
  // A line with an info button: its words, and the tip the button opens.
  // The tip opens on a hover where there is a pointer to hover with, and on
  // a tap or a click everywhere, so a phone reaches it too.
  const infoLines = [projectionText, heatDerating];
  const showTip = (line: HTMLElement, open: boolean) => {
    line.classList.toggle("tip-open", open);
    line.querySelector(".info-button")!.setAttribute("aria-expanded", String(open));
  };
  const closeTips = (except?: HTMLElement) => {
    for (const line of infoLines) if (line !== except) showTip(line, false);
  };
  const hovers = matchMedia("(hover: hover)").matches;
  for (const line of infoLines) {
    const button = line.querySelector<HTMLElement>(".info-button")!;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      closeTips(line);
      // Where a hover has already opened it, a click keeps it open.
      showTip(line, hovers || button.getAttribute("aria-expanded") !== "true");
    });
    if (hovers) {
      button.addEventListener("mouseenter", () => showTip(line, true));
      button.addEventListener("mouseleave", () => showTip(line, false));
    }
  }
  const paintInfo = (line: HTMLElement, words: ProjectionLine | null) => {
    line.querySelector(".info-text")!.textContent = words?.text ?? "";
    line.querySelector(".info-bubble")!.textContent = words?.tip ?? "";
    line.hidden = words === null;
    if (!words) showTip(line, false);
  };
  document.addEventListener("click", () => closeTips());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeTips();
  });
  const peakText = find(".peak-line");
  const chartCard = find(".chart-card");
  const chartTitle = find(".chart-title");
  const mainElement = find("#chart");
  const companionHead = find(".companion-head");
  const companionTabs = find(".chart-tabs");
  const companionElement = find("#companion-chart");
  const chartNote = find(".chart-note");
  const chartKey = find(".chart-key");
  const keyAtLimit = find(".key.at-limit");
  const keyDerating = find(".key.derating");
  const cards = createCards(context);
  element.appendChild(cards.element);
  const dayNav = createDayNav(state, controller, () => visible);
  chartTitle.after(dayNav.element);
  find(".hero-unit").textContent = hero.unit;
  // Each of the hero's three figures wears the colour of its line on the
  // charts, as a tick beside its label, so the two read as the same thing.
  const inkOf = (metric: Metric | null) => {
    for (const each of [pane, ...panes.others]) {
      const index = each?.metrics.indexOf(metric!) ?? -1;
      if (each && index >= 0) return each.colours[index];
    }
    return null;
  };
  const mark = (target: HTMLElement, metric: Metric | null) => {
    const ink = inkOf(metric);
    if (!ink) return;
    target.classList.add("marked");
    target.style.setProperty("--mark", ink);
  };
  mark(find(".gauge-power"), context.registry.metrics.find((metric) => metric.key === hero.key) ?? null);
  mark(heatGauge, heat);
  if (heat) {
    heatGauge.hidden = false;
    find(".gauge-heat .unit").textContent = unitLabel(heat.unit);
  }

  // Featured metrics ride on the hero card. Today's yield is the number most
  // worth answering at a glance.
  const extras = find(".hero-extras");
  const featuredValues = new Map<string, Text>();
  for (const metric of featured) {
    const line = document.createElement("div");
    line.className = metric.feature!.subtle ? "hero-extra subtle" : "hero-extra";
    line.innerHTML = '<span class="label"></span><span class="value">–<span class="unit"></span></span>';
    line.querySelector(".label")!.textContent = metric.feature!.label;
    line.querySelector(".unit")!.textContent = metric.unit;
    featuredValues.set(metric.key, line.querySelector(".value")!.firstChild as Text);
    if (metric.key === context.dailyYield.key) mark(line, metric);
    extras.appendChild(line);
  }

  const shown = (metric: Metric) => seriesShown(metric, state.toggles);
  // The two charts share one window: zooming either zooms both.
  const group = new ChartGroup();
  let visible = false;
  let blinkedFor = state.readings;

  const chartOptions = (isMain: boolean, legend: () => void) => ({
    isMain,
    heroKey: hero.key,
    ratingWatts: context.ratingWatts,
    limitWatts: context.limitWatts,
    timezone: context.timezone,
    fineZoom: matchMedia("(pointer: fine)").matches,
    isToday: (date: string) => date === state.today.today,
    shown,
    onSeriesToggle: (key: string, show: boolean) => {
      state.toggles.set(key, show);
      legend();
    },
    peaksWhileProducing: (metric: Metric) => metric.peak === "while_producing",
    group,
  });

  /** One chart on this screen: its plot, legend, and what it last drew. */
  interface Slot {
    pane: Pane | null;
    element: HTMLElement;
    chart: DayChart | null;
    legend: () => void;
    drawn: unknown[];
    inView: boolean;
    /** The canvas height last given to its chart. */
    height: number;
  }

  const sizeSlot = (slot: Slot, height: number) => {
    slot.height = height;
    slot.chart?.resize(Math.max(280, slot.element.clientWidth || 640), height);
  };

  const legendFor = (slot: Slot, container: HTMLElement) =>
    slot.pane
      ? createLegend(container, slot.pane, shown, (metric) => {
          const showing = shown(metric);
          if (slot.chart) slot.chart.setSeriesShown(metric.key, !showing);
          else {
            state.toggles.set(metric.key, !showing);
            slot.legend();
          }
        })
      : () => {};

  const main: Slot = { pane, element: mainElement, chart: null, legend: () => {}, drawn: [], inView: true, height: 320 };
  main.legend = legendFor(main, find(".main-legend"));
  const companion: Slot = { pane: null, element: companionElement, chart: null, legend: () => {}, drawn: [], inView: true, height: 200 };

  // A chart far below the screen skips its redraws until it comes near, so
  // the cards and the second chart cost nothing while a phone shows the top.
  const observer =
    typeof IntersectionObserver === "function"
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              const slot = entry.target === mainElement ? main : companion;
              slot.inView = entry.isIntersecting;
            }
            if (visible) paintCharts();
          },
          { rootMargin: "100% 0px" },
        )
      : null;
  observer?.observe(mainElement);
  observer?.observe(companionElement);

  const chooseCompanion = (name: string | null) => {
    const chosen = companions.find((candidate) => candidate.name === name) ?? companions[0] ?? null;
    for (const button of companionTabs.children) {
      button.setAttribute("aria-pressed", String((button as HTMLElement).dataset.pane === chosen?.name));
    }
    companion.chart?.destroy();
    companion.chart = null;
    companion.drawn = [];
    companionElement.replaceChildren();
    companion.pane = chosen;
    companion.legend = legendFor(companion, find(".companion-legend"));
    companion.legend();
    if (chosen) rememberCompanion(chosen.name);
  };
  for (const candidate of companions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chart-tab";
    button.dataset.pane = candidate.name;
    button.textContent = candidate.title;
    button.addEventListener("click", () => {
      chooseCompanion(candidate.name);
      if (visible) {
        paintCharts();
        fit();
      }
    });
    companionTabs.appendChild(button);
  }
  companionHead.hidden = companions.length === 0;
  companionElement.hidden = companions.length === 0;
  chooseCompanion(rememberedCompanion());

  /**
   * Sizes the charts. A phone and a narrow computer screen use fixed shares
   * of the window. A wide screen fills down to the footer, or as far as the
   * cards beside the charts reach when that is further; the cards
   * themselves stay as tall as their rows.
   */
  const fit = () => {
    if (!visible) return;
    const page = document.querySelector(".page");
    const pageStyle = page ? getComputedStyle(page) : null;
    const cardTop = chartCard.getBoundingClientRect().top + window.scrollY;
    // Everything in the chart card but the canvases, from the parts around
    // them: a canvas takes its new size a moment after it is asked to, so
    // the card's own height cannot be trusted here.
    const cardStyle = getComputedStyle(chartCard);
    const legends = [...chartCard.querySelectorAll(".u-legend")].reduce((sum, legend) => sum + boxHeight(legend), 0);
    const chrome =
      (parseFloat(cardStyle.paddingTop) || 0) +
      (parseFloat(cardStyle.paddingBottom) || 0) +
      (parseFloat(cardStyle.borderTopWidth) || 0) +
      (parseFloat(cardStyle.borderBottomWidth) || 0) +
      boxHeight(chartCard.querySelector(".card-head")) +
      boxHeight(companionHead) +
      boxHeight(chartKey) +
      boxHeight(chartNote) +
      legends;
    const heights = chartHeights({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      columnHeight: cards.element.offsetHeight,
      screenSpace:
        window.innerHeight -
        cardTop -
        (parseFloat(pageStyle?.rowGap ?? "") || 16) -
        boxHeight(document.querySelector(".footer")) -
        (parseFloat(pageStyle?.paddingBottom ?? "") || 0),
      chrome,
    });
    sizeSlot(main, heights.main);
    sizeSlot(companion, heights.companion);
  };

  const paintMeter = (watts: number, countdown: number | null) => {
    const fraction = context.limitWatts > 0 ? watts / context.limitWatts : 0;
    meter.style.width = (Math.max(0, Math.min(1, fraction)) * 100).toFixed(1) + "%";
    caption.textContent = meterCaption(watts, context.limitWatts, countdown);
  };

  const paintVerdict = () => {
    const now = state.now;
    const reading = now?.reading;
    if (!now || !reading) return;
    const delivered = reading.values[context.limitMetric.key];
    const countdown = context.gridCountdown ? reading.values[context.gridCountdown.key] : null;
    const lastDerate = now.stretches.derating[now.stretches.derating.length - 1];
    const verdict = verdictOf({
      status: statusOf({
        lastReadingMs: state.lastReadingMs,
        nowMs: Date.now(),
        intervalSeconds: context.intervalSeconds,
        sleeping: state.sleeping,
        resumesAt: state.resumesAt,
        troubled: state.troubled,
        timezone: context.timezone,
      }),
      severity: reading.health.severity,
      runMode: reading.health.run_mode,
      watts: typeof delivered === "number" ? delivered : 0,
      limitWatts: context.limitWatts,
      countdownSeconds: typeof countdown === "number" ? countdown : null,
      deratingNow: lastDerate !== undefined && reading.ts - lastDerate[1] <= context.intervalSeconds * 3,
      deratesToday: now.today.derate_count ?? null,
      faultReadingsToday: now.today.fault_readings,
    });
    verdictBox.dataset.tone = verdict.tone;
    // A theme may take its mood from the verdict, so it is told page-wide.
    document.documentElement.dataset.tone = verdict.tone;
    verdictTitle.textContent = verdict.title;
    verdictDetail.textContent = verdict.detail;
  };

  const paintHeat = () => {
    const now = state.now;
    const reading = now?.reading;
    if (!now || !reading || !heat) return;
    const unit = unitLabel(heat.unit);
    heatValue.textContent = formatNumber(reading.values[heat.key], heat.decimals);
    const peak = now.peaks[heat.key];
    heatPeak.textContent = peak == null ? "" : `Highest today ${formatNumber(peak, heat.decimals)} ${unit}`;
    heatPeak.hidden = peak == null;
    paintInfo(heatDerating, heatLine(now.today.derate_count, now.today.derate_seconds));
  };

  const paintHero = () => {
    const now = state.now;
    const reading = now?.reading;
    if (!now || !reading) return;
    heroCard.classList.remove("loading");
    const value = reading.values[hero.key];
    heroValue.textContent = formatNumber(value, hero.decimals);
    const countdown = context.gridCountdown ? reading.values[context.gridCountdown.key] : null;
    // The meter measures what the limit caps, the power delivered, which
    // runs under the panels' power by the inverter's losses.
    const delivered = reading.values[context.limitMetric.key];
    paintMeter(typeof delivered === "number" ? delivered : 0, typeof countdown === "number" ? countdown : null);
    for (const metric of featured) {
      const text = featuredValues.get(metric.key);
      if (text) text.nodeValue = formatNumber(reading.values[metric.key], metric.decimals);
    }
    updated.textContent = new Date(reading.ts * 1000).toLocaleTimeString(undefined, { timeZone: context.timezone });

    const lines = heroLines(now.today, now.projection, {
      decimals: context.dailyYield.decimals,
      unit: context.dailyYield.unit,
      heroUnit: hero.unit,
      timezone: context.timezone,
    });
    paintInfo(projectionText, lines.projection);
    peakText.textContent = lines.peak ?? "";
    peakText.hidden = lines.peak === null;
    paintVerdict();
    paintHeat();

    // The dot and the time flash once for each reading the stream brings.
    if (state.readings !== blinkedFor) {
      blinkedFor = state.readings;
      updatedGroup.classList.remove("flash");
      void updatedGroup.offsetWidth;
      updatedGroup.classList.add("flash");
    }
  };

  const paintDayNav = () => {
    const isToday = state.isToday();
    dayNav.paint();
    chartCard.classList.toggle("historical", !isToday);
    const title = pane ? pane.title : "Power";
    chartTitle.textContent = isToday ? title + " today" : title;
  };

  const paintNote = () => {
    const day = state.day;
    if (state.loadError) {
      chartNote.textContent = state.loadError;
      return;
    }
    if (!day || day.date !== state.selectedDate) return;
    if (!day.count) {
      chartNote.textContent = "Nothing recorded on " + day.date + ".";
    } else if (day.date === state.today.today) {
      const count = state.now?.today.date === day.date ? state.now.today.samples : day.count;
      chartNote.textContent = count.toLocaleString() + " readings since midnight";
    } else {
      // The hero card always speaks for today, so a past day's closing
      // totals are stated here instead.
      const parts = [day.count.toLocaleString() + " readings"];
      for (const metric of context.registry.metrics.filter((candidate) => candidate.summary)) {
        const closing = day.closing[metric.key];
        if (closing !== null && closing !== undefined) {
          parts.push(formatNumber(closing, metric.decimals) + " " + metric.unit + " " + metric.summary);
        }
      }
      chartNote.textContent = parts.join("  ·  ");
    }
  };

  /** Draws one chart, building it the first time, and only when what it
   * draws changed. Returns whether it was built just now. */
  const paintSlot = (slot: Slot, isMain: boolean): boolean => {
    const day = state.day;
    if (!slot.pane || !day || !slot.inView) return false;
    let built = false;
    if (!slot.chart) {
      slot.chart = new DayChart(slot.element, slot.pane, chartOptions(isMain, () => slot.legend()));
      sizeSlot(slot, slot.height);
      built = true;
    }
    const now = state.now;
    const reading = now?.reading;
    const projection =
      isMain && day.date === state.today.today && state.curve && now && reading && reading.ts >= day.from
        ? projectionPath(state.curve, now.projection, now.today.yield_kwh ?? 0, reading.ts, day.from)
        : null;
    // A past day keys to no path at all, so it is never redrawn by readings
    // that belong to today.
    const next = [day, day.latest(), pathKey(projection)];
    if (next.every((part, index) => part === slot.drawn[index])) return built;
    const newDay = slot.drawn[0] !== day;
    slot.drawn = next;
    slot.chart.setData(day, projection);
    slot.legend();
    return built || newDay;
  };

  /** Names the kinds of stretch the shown day has under the power chart.
   * Returns whether the key appeared or went, which moves what is below. */
  const paintKey = (): boolean => {
    const stretches = state.day?.stretches;
    const atLimit = Boolean(stretches?.at_limit.length);
    const derating = Boolean(stretches?.derating.length);
    keyAtLimit.hidden = !atLimit;
    keyDerating.hidden = !derating;
    const wasHidden = chartKey.hidden;
    chartKey.hidden = !atLimit && !derating;
    return wasHidden !== chartKey.hidden;
  };

  const paintCharts = () => {
    const mainChanged = paintSlot(main, true);
    const companionChanged = paintSlot(companion, false);
    const keyChanged = paintKey();
    // A chart built, a new day drawn or the key coming or going can change
    // the card's height, so the layout is fitted again; ordinary readings
    // never do.
    if (mainChanged || companionChanged || keyChanged) fit();
  };

  const paint = () => {
    paintHero();
    paintDayNav();
    paintNote();
    cards.paint(state.now);
    paintCharts();
  };

  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener("resize", () => {
    if (resizeTimer !== null) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fit, 150);
  });

  state.subscribe(() => {
    if (visible) paint();
  });
  // Silence brings no event, so the verdict checks for it on its own.
  setInterval(() => {
    if (visible) paintVerdict();
  }, 5000);
  main.legend();

  return {
    element,
    show() {
      visible = true;
      element.hidden = false;
      // A reading that came while another tab was showing is not flashed.
      blinkedFor = state.readings;
      paint();
      fit();
    },
    hide() {
      visible = false;
      element.hidden = true;
    },
  };
}
