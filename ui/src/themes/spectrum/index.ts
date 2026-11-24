import "../shared.css";
import "./theme.css";
import type { Context } from "../../app/context";
import type { AppState } from "../../app/state";
import { formatNumber } from "../../format";
import { heroToday, svg } from "../shared";

const FROM_HOUR = 5;
const HOURS = 14;
const ROWS = 10;

/** Spectrum: white tiles and colour fields. Its dots are today's average
 * power half hour by half hour, each dot a tenth of the limit. */
export function mount(home: HTMLElement, context: Context, state: AppState): void {
  const tile = document.createElement("section");
  tile.className = "card dots";
  tile.setAttribute("aria-hidden", "true");
  const title = document.createElement("p");
  title.className = "dots-title";
  title.append("Power by half hour", Object.assign(document.createElement("span"), { textContent: "Today" }));
  const picture = svg("svg", { viewBox: `0 0 ${HOURS * 2 * 10} ${ROWS * 10 + 16}` });
  const columns = Array.from({ length: HOURS * 2 }, (_, column) =>
    Array.from({ length: ROWS }, (_, row) => picture.appendChild(svg("circle", { cx: column * 10 + 5, cy: (ROWS - row) * 10 - 5, r: 3.2 }))),
  );
  for (const hour of [6, 9, 12, 15, 18]) {
    const label = svg("text", { x: (hour - FROM_HOUR) * 20 + 5, y: ROWS * 10 + 13, "text-anchor": "middle" });
    label.textContent = String(hour);
    picture.append(label);
  }
  tile.append(title, picture);
  home.querySelector(".sections")?.prepend(tile);

  const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: context.timezone });
  // The day's readings sit on an even clock, so one look at the time zone
  // places them all.
  let drawn = "";
  state.subscribe(() => {
    const today = heroToday(context, state);
    if (!today || !today.timestamps.length || !context.limitWatts) return;
    const last = today.timestamps[today.timestamps.length - 1];
    const key = last + ":" + today.timestamps.length;
    if (key === drawn) return;
    drawn = key;
    const [hour, minute] = clock.format(last * 1000).split(":").map(Number);
    const midnight = last - hour * 3600 - minute * 60 - (last % 60);
    const sums = new Array<number>(HOURS * 2).fill(0);
    const counts = new Array<number>(HOURS * 2).fill(0);
    today.timestamps.forEach((ts, index) => {
      const value = today.values[index];
      const slot = Math.floor((ts - midnight) / 1800) - FROM_HOUR * 2;
      if (value === null || value === undefined || slot < 0 || slot >= sums.length) return;
      sums[slot] += value;
      counts[slot] += 1;
    });
    columns.forEach((dots, slot) => {
      const average = counts[slot] ? sums[slot] / counts[slot] : 0;
      const lit = Math.ceil((average / context.limitWatts) * ROWS - 0.05);
      dots.forEach((dot, row) => dot.classList.toggle("lit", row < lit));
    });
    title.lastElementChild!.textContent = "Today, limit " + formatNumber(context.limitWatts / 1000, 1) + " kW";
  });
}
