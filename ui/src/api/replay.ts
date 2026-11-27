import type { Day, DaySummary, MetricValue, Now, Stretches } from "./bindings";
import { DemoTransport } from "./demo";

/** How much of the recorded day is still to come when the page opens. */
const REMAINING_SECONDS = 3600;

const NO_STRETCHES: Stretches = { at_limit: [], derating: [] };

/** Moves the page's clock, so the recorded morning plays as the present. */
function shiftClock(offsetMs: number): void {
  const RealDate = Date;
  class ShiftedDate extends RealDate {
    constructor(...args: []) {
      if (args.length) super(...args);
      else super(RealDate.now() + offsetMs);
    }
    static override now(): number {
      return RealDate.now() + offsetMs;
    }
  }
  globalThis.Date = ShiftedDate as DateConstructor;
}

/**
 * The synthetic demo with one recorded day in place of its present. The
 * recording keeps its time of day in the browser's timezone and plays at the
 * speed it was read; every other day stays synthetic. For looking at the
 * screens with real readings on a development server only: the recording is
 * private and never part of a build.
 */
class ReplayTransport extends DemoTransport {
  constructor(private readonly recorded: Day) {
    super();
  }

  /** Readings the clock has reached. */
  private reached(): number {
    const now = Date.now() / 1000;
    const index = this.recorded.ts.findIndex((ts) => ts > now);
    return index < 0 ? this.recorded.ts.length : Math.max(1, index);
  }

  private column(key: string, count: number): number[] {
    return (this.recorded.series[key] ?? []).slice(0, count).map((value) => value ?? 0);
  }

  private peaks(count: number): Now["peaks"] {
    const peaks: Now["peaks"] = {};
    for (const key of Object.keys(this.recorded.peaks)) peaks[key] = Math.max(...this.column(key, count));
    return peaks;
  }

  private summary(count: number): DaySummary {
    const { date, ts, closing } = this.recorded;
    const power = this.column("pv_power", count);
    const peak = Math.max(...power);
    const producing = ts.filter((_, index) => power[index] > 0);
    const yieldKwh = this.column("today_kwh", count)[count - 1] ?? 0;
    const finalYield = Number(closing.today_kwh ?? 0);
    return {
      date,
      samples: count,
      yield_kwh: yieldKwh,
      peak_power_w: peak,
      peak_at: ts[power.indexOf(peak)] ?? null,
      producing_from: producing[0] ?? null,
      producing_until: producing[producing.length - 1] ?? null,
      lifetime_kwh: Number(closing.total_kwh ?? 0) - finalYield + yieldKwh,
      fault_readings: 0,
      limit_seconds: 0,
      derate_count: 0,
      derate_seconds: 0,
    };
  }

  override async now(): Promise<Now> {
    const base = await super.now();
    const count = this.reached();
    const today = this.summary(count);
    const values: Record<string, MetricValue | null> = { ...this.recorded.closing, total_kwh: today.lifetime_kwh };
    for (const key of Object.keys(this.recorded.series)) values[key] = this.column(key, count)[count - 1] ?? null;
    return {
      ...base,
      reading: base.reading && { ...base.reading, ts: this.recorded.ts[count - 1], values },
      peaks: this.peaks(count),
      today,
      stretches: NO_STRETCHES,
      // One day is too little to project from, so none is invented.
      projection: { state: "not_enough_history", days: 1 },
    };
  }

  override day(date: string, points?: number): Promise<Day> {
    if (date !== this.recorded.date) return super.day(date, points);
    const count = this.reached();
    const series: Day["series"] = {};
    for (const key of Object.keys(this.recorded.series)) series[key] = this.column(key, count);
    return Promise.resolve({
      ...this.recorded,
      count,
      ts: this.recorded.ts.slice(0, count),
      stretches: NO_STRETCHES,
      series,
      peaks: this.peaks(count),
    });
  }

  override async days(from: string, to: string): Promise<DaySummary[]> {
    const rows = await super.days(from, to);
    return rows.map((row) => (row.date === this.recorded.date ? this.summary(this.reached()) : row));
  }
}

/** The replay, or null when no recording is on hand. */
export async function replayTransport(): Promise<ReplayTransport | null> {
  const response = await fetch("/local-day.json");
  if (!response.ok) return null;
  const recording = (await response.json()) as Day;
  const [year, month, day] = recording.date.split("-").map(Number);
  const shift = Math.floor(new Date(year, month - 1, day).getTime() / 1000) - recording.from;
  const ts = recording.ts.map((stamp) => stamp + shift);
  const shifted: Day = { ...recording, ts, from: recording.from + shift, to: recording.to + shift };
  shiftClock((ts[ts.length - 1] - REMAINING_SECONDS) * 1000 - Date.now());
  return new ReplayTransport(shifted);
}
