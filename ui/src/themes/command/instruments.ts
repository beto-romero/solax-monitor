import { svg } from "../shared";

// Which of the segments a to g each digit lights.
const LIT: Record<string, string> = {
  "0": "abcdef", "1": "bc", "2": "abdeg", "3": "abcdg", "4": "bcfg",
  "5": "acdfg", "6": "acdefg", "7": "abc", "8": "abcdefg", "9": "abcdfg", "-": "g",
};

const SHAPES: Record<string, string> = {
  a: "5,2 43,2 36,10 12,10",
  b: "45,4 45,39 41,43 37,37 37,12",
  c: "45,49 45,84 37,76 37,51 41,45",
  d: "5,86 43,86 36,78 12,78",
  e: "3,49 3,84 11,76 11,51 7,45",
  f: "3,4 3,39 7,43 11,37 11,12",
  g: "9,44 13,40 35,40 39,44 35,48 13,48",
};

/** Segment digits, the dark ones left faintly visible as on a real display. */
export function createReadout(places: number) {
  const element = svg("svg", { class: "readout", viewBox: `0 0 ${places * 54} 88`, "aria-hidden": "true" });
  const digits = Array.from({ length: places }, (_, place) => {
    const group = svg("g", { transform: `translate(${place * 54} 0)` });
    const segments = Object.entries(SHAPES).map(([name, points]) => {
      const segment = svg("polygon", { points, "data-segment": name });
      group.append(segment);
      return segment;
    });
    element.append(group);
    return segments;
  });
  return {
    element,
    paint(value: number | null) {
      const text = value === null ? "----" : String(Math.round(value));
      const padded = text.padStart(places, " ");
      digits.forEach((segments, place) => {
        const lit = LIT[padded[place]] ?? "";
        for (const segment of segments) segment.classList.toggle("lit", lit.includes(segment.getAttribute("data-segment")!));
      });
    },
  };
}

const CELLS = 60;

/** The power delivered as a bank of panel cells, one sixtieth of the
 * inverter's limit each. */
export function createBank() {
  const element = document.createElement("div");
  element.className = "bank";
  element.setAttribute("aria-hidden", "true");
  const cells = Array.from({ length: CELLS }, () => element.appendChild(document.createElement("i")));
  return {
    element,
    paint(fraction: number) {
      const lit = Math.round(Math.max(0, Math.min(1, fraction)) * CELLS);
      cells.forEach((cell, index) => cell.classList.toggle("lit", index < lit));
    },
  };
}

const COLUMN_STEPS = 20;
const COLUMN_TOP = 100;

/** The temperature against a plain 0 to 100 scale. The inverter sends no
 * limit of its own, so no danger mark is drawn. */
export function createColumn() {
  const element = document.createElement("div");
  element.className = "column";
  element.setAttribute("aria-hidden", "true");
  const bars = Array.from({ length: COLUMN_STEPS }, (_, index) => {
    const bar = document.createElement("i");
    const degrees = COLUMN_TOP - index * (COLUMN_TOP / COLUMN_STEPS);
    if (degrees % 25 === 0) bar.dataset.mark = String(degrees);
    element.append(bar);
    return { bar, degrees };
  });
  return {
    element,
    paint(value: number | null) {
      for (const { bar, degrees } of bars) bar.classList.toggle("lit", value !== null && value >= degrees);
    },
  };
}

const STRANDS = 14;

/** Two turns of a mains cycle, drawn as drifting strands. A picture of what
 * the figure beside it means, not a measurement: readings come seconds
 * apart, far too slowly to see the wave itself. */
export function createWave() {
  const element = document.createElement("section");
  element.className = "card wave";
  element.setAttribute("aria-hidden", "true");
  const title = document.createElement("p");
  title.className = "wave-title";
  title.append("Grid cycle");
  const figure = document.createElement("span");
  title.append(figure);
  const width = 400;
  const height = 110;
  const picture = svg("svg", { viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none" });
  const drift = svg("g", { class: "drift" });
  for (let strand = 0; strand < STRANDS; strand++) {
    let path = "";
    for (let x = 0; x <= width * 1.5; x += 5) {
      const y = height / 2 - Math.sin(((x + strand * 5) / width) * Math.PI * 4) * (height / 2 - 8);
      path += (x ? "L" : "M") + x + " " + y.toFixed(1);
    }
    drift.append(svg("path", { d: path, opacity: (0.18 + (strand / STRANDS) * 0.6).toFixed(2) }));
  }
  picture.append(drift);
  element.append(title, picture);
  return {
    element,
    paint(hertz: number | null) {
      figure.textContent = hertz === null ? "–" : hertz.toFixed(2) + " Hz";
    },
  };
}
