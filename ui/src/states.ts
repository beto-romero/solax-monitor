import { SCENES } from "./api/scenes";
import { THEMES } from "./themes";

/** Home's states side by side, for designing them: one frame per staged
 * state, each the real Home showing only its hero card. Development only. */

const WIDTHS = { phone: 390, desktop: 1180 } as const;
type Width = keyof typeof WIDTHS;

const frames = document.getElementById("frames") as HTMLElement;
const picker = document.getElementById("theme") as HTMLSelectElement;
const widthButtons = [...document.querySelectorAll<HTMLButtonElement>("#widths button")];

function remembered(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function remember(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Only a convenience.
  }
}

let themeId = remembered("solax.theme", "standard");
let width = remembered("solax.states-width", "phone") as Width;
if (!(width in WIDTHS)) width = "phone";

for (const theme of THEMES) picker.add(new Option(theme.name, theme.id, false, theme.id === themeId));

/** Keeps each frame as tall as the card inside it, which grows once its
 * first reading arrives and whenever its words wrap differently. */
setInterval(() => {
  for (const frame of frames.querySelectorAll("iframe")) {
    // An element from inside a frame belongs to the frame's own window, so it
    // is not an instance of this page's HTMLElement.
    const hero = frame.contentDocument?.querySelector<HTMLElement>(".hero");
    if (hero?.offsetHeight) frame.style.height = hero.getBoundingClientRect().bottom + "px";
  }
}, 500);

function render(): void {
  frames.dataset.width = width;
  frames.style.setProperty("--frame", WIDTHS[width] + "px");
  for (const button of widthButtons) button.setAttribute("aria-pressed", String(button.dataset.width === width));
  frames.replaceChildren(
    ...SCENES.map((scene) => {
      const figure = document.createElement("figure");
      const caption = document.createElement("figcaption");
      caption.innerHTML = "<strong></strong><a></a>";
      caption.querySelector("strong")!.textContent = scene.name;
      const address = `/?scene=${scene.id}&theme=${themeId}`;
      const open = caption.querySelector("a")!;
      open.href = address;
      open.textContent = "Open full page";
      const frame = document.createElement("iframe");
      frame.title = scene.name;
      frame.loading = "lazy";
      frame.src = address + "&embed=hero";
      figure.append(caption, frame);
      return figure;
    }),
  );
}

picker.addEventListener("change", () => {
  themeId = picker.value;
  remember("solax.theme", themeId);
  render();
});
for (const button of widthButtons) {
  button.addEventListener("click", () => {
    width = button.dataset.width as Width;
    remember("solax.states-width", width);
    render();
  });
}
render();
