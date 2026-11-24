// The theme's own numerals, drawn cell by cell on a ten by nine grid.
const GLYPHS: Record<string, string[]> = {
  "0": ["  ######  ", " ######## ", "###    ###", "###    ###", "###    ###", "###    ###", "###    ###", " ######## ", "  ######  "],
  "1": ["    ###   ", "  #####   ", " ######   ", "    ###   ", "    ###   ", "    ###   ", "    ###   ", " #########", " #########"],
  "2": [" #######  ", "######### ", "##     ###", "       ###", "     #### ", "   ####   ", " ####     ", "##########", "##########"],
  "3": [" #######  ", "######### ", "       ###", "       ###", "   #####  ", "       ###", "       ###", "######### ", " #######  "],
  "4": ["     #### ", "    ##### ", "   ###### ", "  ### ### ", " ###  ### ", "##########", "##########", "      ### ", "      ### "],
  "5": ["##########", "##########", "###       ", "########  ", "######### ", "       ###", "       ###", "######### ", " #######  "],
  "6": ["  ####### ", " ######## ", "###       ", "########  ", "######### ", "###    ###", "###    ###", " ######## ", "  ######  "],
  "7": ["##########", "##########", "       ###", "      ### ", "     ###  ", "    ###   ", "   ###    ", "   ###    ", "   ###    "],
  "8": ["  ######  ", " ######## ", "###    ###", "###    ###", "  ######  ", "###    ###", "###    ###", " ######## ", "  ######  "],
  "9": ["  ######  ", " ######## ", "###    ###", "###    ###", " #########", "  ########", "       ###", " ######## ", " #######  "],
  "-": ["          ", "          ", "          ", "          ", "  ######  ", "  ######  ", "          ", "          ", "          "],
};
const BLANK = Array<string>(9).fill(" ".repeat(10));
const HEIGHT = 10;
/** A numeral, its shadow, and the gap to the next one. */
const ADVANCE = 12;
const NOISE = "#%&@$+=*";
const FRAMES = 5;

/** A number as rows of text: each numeral is built out of itself, with the
 * shadow it throws kept apart so it can take a dimmer ink. */
export function asciiNumber(text: string): { body: string[]; shadow: string[] } {
  const width = text.length * ADVANCE;
  const body = Array.from({ length: HEIGHT }, () => Array<string>(width).fill(" "));
  const shadow = Array.from({ length: HEIGHT }, () => Array<string>(width).fill(" "));
  [...text].forEach((character, place) => {
    (GLYPHS[character] ?? BLANK).forEach((row, y) => {
      [...row].forEach((cell, x) => {
        if (cell === "#") body[y][place * ADVANCE + x] = character;
      });
    });
  });
  for (let y = 0; y < HEIGHT - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      if (body[y][x] !== " " && body[y + 1][x + 1] === " ") shadow[y + 1][x + 1] = ":";
    }
  }
  return { body: body.map((row) => row.join("")), shadow: shadow.map((row) => row.join("")) };
}

/** A bar of text blocks, such as "[████░░]". */
export function asciiBar(share: number, cells: number): string {
  const lit = Math.round(Math.max(0, Math.min(1, share)) * cells);
  return "[" + "█".repeat(lit) + "░".repeat(cells - lit) + "]";
}

/** The power figure in ASCII art. Cells that change crackle briefly. */
export function createBanner(places: number) {
  const element = document.createElement("div");
  element.className = "ascii";
  element.setAttribute("aria-hidden", "true");
  element.style.setProperty("--columns", String(places * ADVANCE));
  const shadow = element.appendChild(document.createElement("pre"));
  shadow.className = "ascii-shadow";
  const body = element.appendChild(document.createElement("pre"));
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let shown = "";
  let timer = 0;
  return {
    element,
    paint(value: number | null) {
      const text = value === null ? "-".repeat(places) : String(Math.round(value));
      const next = asciiNumber(text);
      const target = next.body.join("\n");
      if (target === shown) return;
      const before = shown;
      shown = target;
      window.clearInterval(timer);
      shadow.textContent = next.shadow.join("\n");
      if (!before || still.matches) {
        body.textContent = target;
        return;
      }
      let frame = 0;
      const draw = () => {
        frame += 1;
        const done = frame > FRAMES;
        body.textContent = done
          ? target
          : [...target]
              .map((cell, index) => (cell === before[index] || cell === " " ? cell : NOISE[Math.floor(Math.random() * NOISE.length)]))
              .join("");
        if (done) window.clearInterval(timer);
      };
      timer = window.setInterval(draw, 45);
      draw();
    },
  };
}
