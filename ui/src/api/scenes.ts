import type { Now } from "./bindings";
import type { Transport } from "./transport";

/** The states Home can be in, each with an address that stages it on a
 * demo, so a designer can look at every one without waiting for the plant
 * to reach it. The figures are made up. */
export const SCENES = [
  { id: "loading", name: "Waiting for the first reading" },
  { id: "good", name: "Producing normally" },
  { id: "earlier-fault", name: "Producing, faults earlier today" },
  { id: "limit", name: "At the inverter's limit" },
  { id: "heat", name: "Held back by heat" },
  { id: "warn", name: "Running on backup (EPS)" },
  { id: "fault", name: "Fault" },
  { id: "stale", name: "No reading for a while" },
  { id: "asleep", name: "Asleep for the night" },
  { id: "countdown", name: "Connecting to the grid" },
  { id: "idle", name: "Not producing" },
] as const;

export type SceneId = (typeof SCENES)[number]["id"];

function sceneInAddress(): string | null {
  return typeof location === "undefined" ? null : new URLSearchParams(location.search).get("scene");
}

/** The present as it would be in the given scene. */
export function staged(now: Now, scene: string | null = sceneInAddress()): Now {
  const { reading } = now;
  if (!scene) return now;
  if (scene === "loading") return { ...now, reading: null };
  if (!reading) return now;
  const values = reading.values;
  const calm = { ...now.today, fault_readings: 0, derate_count: 0, derate_seconds: 0 };
  const noStretches = { at_limit: [], derating: [] };
  // A plant with weeks recorded, so the end-of-day estimate shows.
  const onPace: Now["projection"] = { state: "on_pace", expected_kwh: 11.7, low_kwh: 10.9, high_kwh: 12.4, based_on_days: 14 };
  switch (scene) {
    case "good":
      return {
        ...now,
        reading: { ...reading, values: { ...values, pv_power: 1840, ac_power: 1795, inverter_temperature: 52, grid_countdown: 0 }, health: { run_mode: "Normal", severity: "ok", fault: null } },
        peaks: { ...now.peaks, inverter_temperature: 54 },
        today: calm,
        stretches: noStretches,
        projection: onPace,
      };
    case "earlier-fault":
      return {
        ...now,
        reading: { ...reading, values: { ...values, pv_power: 1840, ac_power: 1795, inverter_temperature: 52, grid_countdown: 0 }, health: { run_mode: "Normal", severity: "ok", fault: null } },
        peaks: { ...now.peaks, inverter_temperature: 54 },
        today: { ...calm, fault_readings: 4 },
        stretches: noStretches,
      };
    case "limit":
      return { ...now, reading: { ...reading, values: { ...values, pv_power: 3352, ac_power: 3298 } } };
    case "heat":
      return {
        ...now,
        reading: { ...reading, values: { ...values, pv_power: 2510, ac_power: 2475, inverter_temperature: 85 } },
        peaks: { ...now.peaks, inverter_temperature: 85 },
        today: { ...now.today, derate_count: 3, derate_seconds: 1620 },
        stretches: { at_limit: [], derating: [[reading.ts - 540, reading.ts]] },
      };
    case "warn":
      return {
        ...now,
        reading: { ...reading, values: { ...values, pv_power: 620, ac_power: 0, run_mode: "EPS" }, health: { run_mode: "EPS", severity: "warn", fault: null } },
        today: calm,
      };
    case "fault":
      return {
        ...now,
        reading: {
          ...reading,
          values: { ...values, pv_power: 0, ac_power: 0, run_mode: "Fault" },
          health: { run_mode: "Fault", severity: "fault", fault: { codes: [{ code: "1", label: "Grid Lost Fault" }] } },
        },
        today: { ...now.today, fault_readings: 12 },
      };
    case "stale":
      return { ...now, reading: { ...reading, ts: reading.ts - 300 } };
    case "asleep": {
      const tomorrowSix = new Date();
      tomorrowSix.setDate(tomorrowSix.getDate() + 1);
      tomorrowSix.setHours(6, 0, 0, 0);
      return {
        ...now,
        reading: { ...reading, ts: reading.ts - 3 * 3600, values: { ...values, pv_power: 0, ac_power: 0 } },
        poller: { ...now.poller, sleeping: true, resumes_at: Math.floor(tomorrowSix.getTime() / 1000) },
        today: calm,
      };
    }
    case "countdown":
      return {
        ...now,
        reading: { ...reading, values: { ...values, pv_power: 40, ac_power: 0, grid_countdown: 35, run_mode: "Waiting" }, health: { run_mode: "Waiting", severity: "info", fault: null } },
        today: calm,
      };
    case "idle":
      return { ...now, reading: { ...reading, values: { ...values, pv_power: 0, ac_power: 0 } } };
    default:
      return now;
  }
}

/** Makes a demo transport show the scene in the address, on its present and
 * on its live stream. A sleeping poller pushes no readings, only word that
 * it sleeps, so the asleep scene streams just that. */
export function withScene<T extends Transport>(transport: T): T {
  const scene = sceneInAddress();
  if (!scene) return transport;
  const now = transport.now.bind(transport);
  transport.now = () => now().then((present) => staged(present, scene));
  if (scene === "asleep") {
    transport.openLive = (handlers) => {
      handlers.opened();
      void transport.now().then((present) => handlers.event({ type: "poller", ...present.poller }));
      return () => {};
    };
  }
  return transport;
}
