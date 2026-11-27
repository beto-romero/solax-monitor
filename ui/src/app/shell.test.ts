import { expect, test } from "vitest";
import { footerLine, statusOf } from "./shell";

const base = { intervalSeconds: 5, sleeping: false, resumesAt: null, troubled: false, timezone: "Asia/Kolkata", locale: "en-GB" };
const nowMs = Date.UTC(2026, 9, 4, 12, 0, 0);

test("a recent reading reads as Live", () => {
  expect(statusOf({ ...base, lastReadingMs: nowMs - 10_000, nowMs })).toEqual({ kind: "live", text: "Live", stale: false });
});

/** The text with no-break spaces, which keep it on one line. */
const unbroken = (text: string) => text.replaceAll(" ", "\u00a0");

test("a reading older than three polls, and at least half a minute, reads as stale", () => {
  expect(statusOf({ ...base, lastReadingMs: nowMs - 45_000, nowMs })).toEqual({ kind: "stale", text: "No reading for " + unbroken("45 s"), stale: true });
});

test("a long silence reads in minutes and hours, not seconds", () => {
  const stale = (seconds: number) => statusOf({ ...base, lastReadingMs: nowMs - seconds * 1000, nowMs }).text;
  expect(stale(95)).toBe("No reading for " + unbroken("2 min"));
  expect(stale(19_362)).toBe("No reading for " + unbroken("5 h 23 min"));
});

test("silence while the poller sleeps reads as asleep until it wakes", () => {
  const resumesAt = Date.UTC(2026, 9, 4, 23, 30) / 1000;
  expect(statusOf({ ...base, sleeping: true, resumesAt, lastReadingMs: nowMs - 600_000, nowMs })).toEqual({
    kind: "asleep",
    text: "Asleep until 05:00",
    stale: false,
  });
});

test("a failed stream reads as Reconnecting until a reading arrives", () => {
  expect(statusOf({ ...base, troubled: true, lastReadingMs: nowMs - 10_000, nowMs })).toEqual({ kind: "error", text: "Reconnecting", stale: false });
});

test("no reading at all says it is waiting for one", () => {
  expect(statusOf({ ...base, lastReadingMs: 0, nowMs })).toEqual({ kind: "", text: "Waiting for the first reading", stale: false });
});

test("the footer line says how often it updates, since when it records and the room it takes", () => {
  const input = { intervalSeconds: 5, storageBytes: 4_194_304, timezone: "Asia/Kolkata", demo: false, locale: "en-GB" };
  const october30 = Date.UTC(2026, 9, 30, 1, 0) / 1000;
  expect(footerLine({ ...input, earliest: october30, nowSeconds: Date.UTC(2026, 10, 26) / 1000 })).toBe("Updates every 5 s · Recording since 30 Oct · 4.0 MB");
  // A record begun in an earlier year names that year.
  expect(footerLine({ ...input, earliest: october30, nowSeconds: Date.UTC(2027, 1, 2) / 1000 })).toBe("Updates every 5 s · Recording since 30 Oct 2026 · 4.0 MB");
});
