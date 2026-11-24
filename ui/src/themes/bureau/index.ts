import "../shared.css";
import "./theme.css";
import type { Context } from "../../app/context";
import type { AppState } from "../../app/state";
import { formatNumber } from "../../format";
import { heroToday } from "../shared";

const ENTRIES = 72;

/**
 * Bureau: an office terminal that files every reading. Its ledger is the
 * day's latest readings themselves, the newest entered last and brightest.
 */
export function mount(home: HTMLElement, context: Context, state: AppState): void {
  const ledger = document.createElement("section");
  ledger.className = "card ledger";
  ledger.setAttribute("aria-hidden", "true");
  const title = document.createElement("p");
  title.className = "ledger-title";
  title.append("Latest entries", Object.assign(document.createElement("span"), { textContent: context.hero.unit }));
  const grid = document.createElement("div");
  grid.className = "ledger-grid";
  const cells = Array.from({ length: ENTRIES }, () => grid.appendChild(document.createElement("i")));
  ledger.append(title, grid);
  home.querySelector(".sections")?.prepend(ledger);

  state.subscribe(() => {
    const today = heroToday(context, state);
    if (!today) return;
    const latest = today.values.filter((value) => value !== null).slice(-ENTRIES);
    cells.forEach((cell, index) => {
      const value = latest[latest.length - ENTRIES + index];
      cell.textContent = value === undefined ? "····" : formatNumber(value, 0).replace(/\D/g, "").padStart(4, "0");
      cell.className = index === ENTRIES - 1 ? "newest" : index >= ENTRIES - 12 ? "recent" : "";
    });
  });
}
