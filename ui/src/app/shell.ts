import type { Health } from "../api/bindings";
import { browserVisibility } from "../data/live";
import { formatBytes, formatDuration, timeOfDay } from "../format";
import type { Context } from "./context";
import type { AppState } from "./state";

export interface StatusInput {
  lastReadingMs: number;
  nowMs: number;
  intervalSeconds: number;
  sleeping: boolean;
  resumesAt: number | null;
  troubled: boolean;
  timezone: string;
  locale?: string;
}

export interface Status {
  kind: "" | "live" | "stale" | "asleep" | "error";
  text: string;
  /** The page greys its live figures while this is set. */
  stale: boolean;
}

/**
 * What the status pill says. Freshness is measured from when the latest
 * reading was taken, not from when the page loaded it. Silence overnight is
 * expected and reads as asleep; silence by day reads as stale. A failed
 * stream reads as reconnecting until a reading arrives.
 */
export function statusOf(input: StatusInput): Status {
  if (!input.lastReadingMs) {
    return input.troubled
      ? { kind: "error", text: "Reconnecting", stale: false }
      : { kind: "", text: "Waiting for the first reading", stale: false };
  }
  const age = (input.nowMs - input.lastReadingMs) / 1000;
  const limit = Math.max(30, input.intervalSeconds * 3);
  if (age > limit) {
    if (input.sleeping) {
      const until = input.resumesAt ? " until " + timeOfDay(input.resumesAt, input.timezone, input.locale) : "";
      return { kind: "asleep", text: "Asleep" + until, stale: false };
    }
    // Seconds while they count, hours and minutes once they no longer do.
    const lasted = age < 60 ? `${Math.round(age)}\u00a0s` : formatDuration(age);
    return { kind: "stale", text: "No reading for " + lasted, stale: true };
  }
  if (input.troubled) return { kind: "error", text: "Reconnecting", stale: false };
  return { kind: "live", text: "Live", stale: false };
}

export interface FooterLineInput {
  intervalSeconds: number;
  earliest: number;
  storageBytes: number;
  nowSeconds: number;
  timezone: string;
  demo: boolean;
  locale?: string;
}

/** The footer's one line about the store: how often it updates, since when
 * it records, and the room it takes. The year shows only once it differs. */
export function footerLine(input: FooterLineInput): string {
  // The page is in English, so its dates are too, whatever the browser's
  // language: "30 Oct", not "30 oct".
  input = { ...input, locale: input.locale ?? "en-GB" };
  const year = (seconds: number) => new Date(seconds * 1000).toLocaleString("en", { timeZone: input.timezone, year: "numeric" });
  const since = new Date(input.earliest * 1000).toLocaleDateString(input.locale, {
    timeZone: input.timezone,
    day: "numeric",
    month: "short",
    ...(year(input.earliest) === year(input.nowSeconds) ? {} : { year: "numeric" }),
  });
  const updates = `Updates every ${input.intervalSeconds} s`;
  return input.demo
    ? `${updates} · Synthetic history since ${since}`
    : `${updates} · Recording since ${since} · ${formatBytes(input.storageBytes, input.locale)}`;
}

function byId<Element extends HTMLElement>(id: string): Element {
  return document.getElementById(id) as Element;
}

/** Paints the parts of the page every tab shares: the status and fault
 * pills, the footer and the export link. */
export function startShell(context: Context, state: AppState): void {
  const status = byId("status");
  const statusText = byId("status-text");
  const faultPill = byId("fault-pill");
  const faultPillText = byId("fault-pill-text");
  const faultPillCodes = byId("fault-pill-codes");
  const footerNote = byId("footer-note");
  const exportLink = byId<HTMLAnchorElement>("export");
  const exportText = byId("export-text");

  const isDemo = document.documentElement.dataset.demo === "true";
  if (isDemo) {
    byId("subtitle").textContent = "Synthetic telemetry · browser-local time";
  }

  const paintStatus = () => {
    // Until the present has been asked for, the pill keeps saying Connecting.
    if (!state.now && !state.troubled) return;
    const current = statusOf({
      lastReadingMs: state.lastReadingMs,
      nowMs: Date.now(),
      intervalSeconds: context.intervalSeconds,
      sleeping: state.sleeping,
      resumesAt: state.resumesAt,
      troubled: state.troubled,
      timezone: context.timezone,
    });
    // Only the state classes change, so a pulse under way is not cut short.
    for (const kind of ["live", "stale", "asleep", "error"]) status.classList.toggle(kind, kind === current.kind);
    statusText.textContent = isDemo && current.kind === "live" ? "Demo" : current.text;
    document.body.classList.toggle("stale", current.stale);
  };

  // The inverter's own verdict on itself. A fault outranks everything else on
  // the page: the numbers can look perfectly reasonable while the thing is
  // disconnected from the grid.
  const paintFault = (health: Health | null, ts: number | null) => {
    const severity = health?.severity;
    const codes = health?.fault?.codes ?? [];
    // The dongle can attach an Error object while the run mode still reads
    // Normal, so the codes alone also raise the pill.
    if (!health || (severity !== "fault" && severity !== "warn" && !codes.length)) {
      faultPill.hidden = true;
      return;
    }
    faultPill.hidden = false;
    faultPill.classList.toggle("warn", severity !== "fault");
    faultPillText.textContent = severity === "fault" || severity === "warn" ? (health.run_mode ?? "Fault") : "Error reported";
    const detail = codes.map((entry) => entry.label).join("  ·  ");
    faultPillCodes.textContent = detail ? "  ·  " + detail : "";
    faultPill.title = ts ? "as of " + new Date(ts * 1000).toLocaleTimeString(undefined, { timeZone: context.timezone }) : "";
  };

  const paintFooter = () => {
    const now = state.now;
    if (!now) return;
    // A server that predates the stored history leaves these out entirely.
    if (now.earliest == null) {
      footerNote.textContent = `Updates every ${context.intervalSeconds} s · No readings stored yet`;
      return;
    }
    footerNote.textContent = footerLine({
      intervalSeconds: context.intervalSeconds,
      earliest: now.earliest,
      storageBytes: now.storage_bytes,
      nowSeconds: Date.now() / 1000,
      timezone: context.timezone,
      demo: isDemo,
    });
  };

  const paintExport = () => {
    exportLink.href = context.transport.exportUrl(state.selectedDate);
    exportText.textContent = state.isToday() ? "Download today as CSV" : "Download " + state.selectedDate + " as CSV";
  };
  // In demo mode the CSV is a browser-created snapshot, so refresh today's
  // blob at click time rather than rebuilding it on every live UI update.
  exportLink.addEventListener("click", () => {
    if (isDemo) exportLink.href = context.transport.exportUrl(state.selectedDate, true);
  });

  // The dots pulse once per reading rather than forever, so the screen is
  // not redrawn every frame. Restarting an animation needs the class
  // removed, a reflow forced, then the class added again.
  let beatFor = state.readings;
  const beat = () => {
    if (state.readings === beatFor) return;
    beatFor = state.readings;
    for (const pill of [status, faultPill]) {
      pill.classList.remove("beat");
      void pill.offsetWidth;
      pill.classList.add("beat");
    }
  };

  const paint = () => {
    paintStatus();
    paintFault(state.now?.reading?.health ?? null, state.now?.reading?.ts ?? null);
    paintFooter();
    paintExport();
    beat();
  };
  state.subscribe(paint);
  paint();

  // Staleness is judged once a second, and only while the page can be seen.
  let staleTimer: ReturnType<typeof setInterval> | null = null;
  const runTimer = () => {
    if (staleTimer !== null) clearInterval(staleTimer);
    staleTimer = browserVisibility.visible() ? setInterval(paintStatus, 1000) : null;
  };
  browserVisibility.onChange(runTimer);
  runTimer();
}
