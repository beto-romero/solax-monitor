import "./styles/uplot.css";
import "./styles/main.css";
import { BrowserTransport } from "./api/browser";
import { DemoTransport } from "./api/demo";
import { withScene } from "./api/scenes";
import { contextFrom } from "./app/context";
import { Controller } from "./app/controller";
import { parseRoute, paintTabs, type Route, type Tab } from "./app/router";
import { startShell } from "./app/shell";
import { AppState } from "./app/state";
import { DaysIndex } from "./data/days-index";
import { TodayTracker } from "./data/today";
import { localDate } from "./format";
import { createThemePicker, theme } from "./themes";
import { createHome } from "./screens/home";
import { createMonth } from "./screens/month";
import { createYear } from "./screens/year";
import type { Screen } from "./screens/screen";

async function start(): Promise<void> {
  document.documentElement.dataset.theme = theme.id;
  // The states page shows only the hero card of each staged state.
  if (import.meta.env.DEV && new URLSearchParams(location.search).get("embed") === "hero") document.documentElement.dataset.embed = "hero";
  document.documentElement.style.colorScheme = theme.scheme;
  const themeModule = await theme.load();
  document.querySelector(".topbar-status")?.prepend(createThemePicker());
  const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
  // A private recording replays only on a development server, never in a build.
  const replay = import.meta.env.DEV && import.meta.env.VITE_REPLAY === "true" ? await (await import("./api/replay")).replayTransport() : null;
  // A demo can be staged in any of Home's states with ?scene= in the address.
  const transport = replay ? withScene(replay) : demoMode ? withScene(new DemoTransport()) : new BrowserTransport();
  if (demoMode) document.documentElement.dataset.demo = "true";
  const context = contextFrom(transport, await transport.registry());
  const today = new TodayTracker(localDate(Date.now() / 1000, context.timezone), context.timezone);
  const state = new AppState(new DaysIndex((from, to) => transport.days(from, to)), today);
  const container = document.getElementById("screens") as HTMLElement;
  const controller = new Controller(context, state, () => container.clientWidth || 640);
  const screens: Record<Tab, Screen> = {
    home: createHome(context, state, controller),
    month: createMonth(context, state),
    year: createYear(context, state),
  };
  for (const screen of Object.values(screens)) container.appendChild(screen.element);
  themeModule.mount?.(screens.home.element, context, state);
  startShell(context, state);
  if (replay) (document.getElementById("subtitle") as HTMLElement).textContent = "Recorded readings · earlier days synthetic";

  // A month's bar or a page check picks the day Home shows with this event.
  window.addEventListener("solax:select-day", (event) => {
    const date = (event as CustomEvent<string>).detail;
    if (typeof date === "string") void controller.selectDay(date);
  });

  const remembered: Partial<Record<Tab, string>> = {};
  const scrollPositions: Partial<Record<Tab, number>> = {};
  let current: Route | null = null;
  const route = () => {
    const next = parseRoute(location.hash);
    if (current) {
      scrollPositions[current.tab] = window.scrollY;
      screens[current.tab].hide();
    }
    current = next;
    remembered[next.tab] = location.hash || "#/";
    paintTabs(document.getElementById("tabs") as HTMLElement, next, state.today.today, remembered);
    screens[next.tab].show(next.param);
    window.scrollTo(0, scrollPositions[next.tab] ?? 0);
  };
  window.addEventListener("hashchange", route);
  route();
  await controller.boot();
}

start().catch((error) => {
  const status = document.getElementById("status-text");
  if (status) status.textContent = "Failed to load";
  console.error(error);
});
