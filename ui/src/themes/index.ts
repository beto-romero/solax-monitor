import type { Context } from "../app/context";
import type { AppState } from "../app/state";

/** The colours and lettering the charts draw with; a canvas reads no CSS. */
export interface ChartInk {
  solar: string;
  grid: string;
  inverter: string;
  spare: string;
  heat: string;
  text: string;
  muted: string;
  faint: string;
  hairline: string;
  gridline: string;
  surface: string;
  /** Anything before the size in a CSS font, such as "700 condensed". */
  fontStyle: string;
  fontFamily: string;
  /** Crosses where the grid lines meet, in place of the lines. */
  crosses: boolean;
}

/** What a theme adds to the page beyond its styles. */
export interface ThemeModule {
  mount?(home: HTMLElement, context: Context, state: AppState): void;
}

export interface Theme {
  id: string;
  name: string;
  scheme: "dark" | "light";
  ink: ChartInk;
  /** Brings in the theme's styles and instruments, only once it is chosen. */
  load(): Promise<ThemeModule>;
}

const STANDARD: Theme = {
  id: "standard",
  name: "Standard",
  scheme: "dark",
  ink: {
    solar: "#ffc24d",
    grid: "#4fd6c8",
    inverter: "#ff8f4c",
    spare: "#b8a6ff",
    heat: "#ff8f4c",
    text: "#f4f4f4",
    muted: "#a3a3a3",
    faint: "#8a8a8a",
    hairline: "#262626",
    gridline: "#1b1b1b",
    surface: "#0e0e0e",
    fontStyle: "",
    fontFamily: "Inter, system-ui, sans-serif",
    crosses: false,
  },
  load: () => Promise.resolve({}),
};

const COMMAND: Theme = {
  id: "command",
  name: "Command",
  scheme: "dark",
  ink: {
    solar: "#7df59a",
    grid: "#5fc8ff",
    inverter: "#ffb04a",
    spare: "#d9d2ff",
    heat: "#ff4334",
    text: "#ffd9a8",
    muted: "#e08a2e",
    faint: "#c47a2c",
    hairline: "#6b3d10",
    gridline: "#2a1a08",
    surface: "#050403",
    fontStyle: "700 condensed",
    fontFamily: '"Helvetica Neue", "Arial Narrow", "Liberation Sans Narrow", Arial, sans-serif',
    crosses: true,
  },
  load: () => import("./command"),
};

const BUREAU: Theme = {
  id: "bureau",
  name: "Bureau",
  scheme: "dark",
  ink: {
    solar: "#9fe8ff",
    grid: "#7fb0ff",
    inverter: "#ffd08a",
    spare: "#c9b8ff",
    heat: "#ff8f7a",
    text: "#d8f4ff",
    muted: "#8fc4dc",
    faint: "#78a9c4",
    hairline: "#1f4f78",
    gridline: "#0d2b47",
    surface: "#061a30",
    fontStyle: "",
    fontFamily: 'ui-monospace, Menlo, Consolas, "Liberation Mono", monospace',
    crosses: true,
  },
  load: () => import("./bureau"),
};

const BRIDGE: Theme = {
  id: "bridge",
  name: "Bridge",
  scheme: "dark",
  ink: {
    solar: "#ffd27a",
    grid: "#7fd8c0",
    inverter: "#ff9a76",
    spare: "#a9b8ff",
    heat: "#ff5d5d",
    text: "#fbeedd",
    muted: "#c9b7d8",
    faint: "#a697b8",
    hairline: "#4a3f5c",
    gridline: "#241d30",
    surface: "#0b0810",
    fontStyle: "600",
    fontFamily: '"Avenir Next Condensed", "Arial Narrow", "Liberation Sans Narrow", sans-serif',
    crosses: false,
  },
  load: () => import("./bridge"),
};

const PHOSPHOR: Theme = {
  id: "phosphor",
  name: "Phosphor",
  scheme: "dark",
  ink: {
    solar: "#8dff7a",
    grid: "#c8ff5c",
    inverter: "#ffc04d",
    spare: "#5ce0b0",
    heat: "#ff8a3d",
    text: "#c9ffbf",
    muted: "#6fd463",
    faint: "#55b04c",
    hairline: "#1f5a1c",
    gridline: "#0d2a0c",
    surface: "#041004",
    fontStyle: "",
    fontFamily: 'ui-monospace, Menlo, Consolas, "Liberation Mono", monospace',
    crosses: false,
  },
  load: () => import("./phosphor"),
};

const DAYLIGHT: Theme = {
  id: "daylight",
  name: "Daylight",
  scheme: "light",
  ink: {
    solar: "#a86500",
    grid: "#0a7085",
    inverter: "#b83a10",
    spare: "#5f48c4",
    heat: "#c9281c",
    text: "#0f1f3d",
    muted: "#40506e",
    faint: "#55637f",
    hairline: "#c5d0e0",
    gridline: "#e2e9f2",
    surface: "#ffffff",
    fontStyle: "",
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
    crosses: false,
  },
  load: () => import("./daylight"),
};

const SPECTRUM: Theme = {
  id: "spectrum",
  name: "Spectrum",
  scheme: "light",
  ink: {
    solar: "#c2185b",
    grid: "#1f5fd0",
    inverter: "#b54708",
    spare: "#6d3fd6",
    heat: "#d11a2a",
    text: "#141416",
    muted: "#55555c",
    faint: "#66666e",
    hairline: "#dcdce2",
    gridline: "#ededf1",
    surface: "#ffffff",
    fontStyle: "",
    fontFamily: '"Avenir Next", Avenir, "Segoe UI", sans-serif',
    crosses: false,
  },
  load: () => import("./spectrum"),
};

const SOFT: Theme = {
  id: "soft",
  name: "Soft",
  scheme: "light",
  ink: {
    solar: "#9a6400",
    grid: "#0b6f93",
    inverter: "#b5400f",
    spare: "#5c55b8",
    heat: "#c9281c",
    text: "#26313a",
    muted: "#4a5761",
    faint: "#55626c",
    hairline: "#c2ccd2",
    gridline: "#d5dde1",
    surface: "#e3e9ec",
    fontStyle: "",
    fontFamily: 'ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif',
    crosses: false,
  },
  load: () => import("./soft"),
};

export const THEMES: Theme[] = [STANDARD, COMMAND, BUREAU, BRIDGE, PHOSPHOR, DAYLIGHT, SPECTRUM, SOFT];

const STORAGE_KEY = "solax.theme";

function chosenTheme(): Theme {
  try {
    // An address can ask for a theme without changing the one remembered.
    const id = new URLSearchParams(location.search).get("theme") ?? localStorage.getItem(STORAGE_KEY);
    return THEMES.find((theme) => theme.id === id) ?? STANDARD;
  } catch {
    return STANDARD;
  }
}

/** The theme for this visit. Changing it loads the page again, so everything
 * drawn on a canvas starts out in the new one. */
export const theme = chosenTheme();

/** The picker in the top bar. */
export function createThemePicker(): HTMLElement {
  const label = document.createElement("label");
  label.className = "theme-picker";
  const name = document.createElement("span");
  name.textContent = "Theme";
  const select = document.createElement("select");
  for (const option of THEMES) select.add(new Option(option.name, option.id, false, option === theme));
  select.addEventListener("change", () => {
    try {
      localStorage.setItem(STORAGE_KEY, select.value);
      const address = new URL(location.href);
      address.searchParams.delete("theme");
      history.replaceState(null, "", address);
      location.reload();
    } catch {
      // Without storage a theme cannot outlive the reload it needs.
      select.value = theme.id;
    }
  });
  label.append(name, select);
  return label;
}
