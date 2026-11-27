import { execSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServer, defineConfig, type Plugin, type ViteDevServer } from "vite";

// A private recording of a day, handed to the replay on a development server.
// Applied only when serving, so it can never end up in a build.
const LOCAL_DAY = resolve(import.meta.dirname, "../data.json");
const localDay = {
  name: "local-day",
  apply: "serve" as const,
  configureServer(server: { middlewares: { use(path: string, handler: (request: unknown, response: NodeJS.WritableStream & { setHeader(name: string, value: string): void }, next: () => void) => void): void } }) {
    server.middlewares.use("/local-day.json", (_request, response, next) => {
      if (!existsSync(LOCAL_DAY)) return next();
      response.setHeader("content-type", "application/json");
      createReadStream(LOCAL_DAY).pipe(response);
    });
  },
};

// Mohana's page as it was before the redesign, served at /original/ on a
// development server for comparing the two. It is taken from git, from his
// repository's main branch when that remote is fetched, else from the commit
// the redesign started from, into a folder git ignores.
const ORIGINAL_DIR = resolve(import.meta.dirname, ".original");
const REDESIGN_BASE = "169c77a";
const BACK_LINK = `<a href="/" style="position:fixed;right:16px;bottom:16px;z-index:99;padding:8px 14px;border-radius:999px;background:#f4f4f4;color:#111;font:600 13px system-ui,sans-serif;text-decoration:none;box-shadow:0 4px 14px rgb(0 0 0/.35)">\u2190 Back to the redesign</a>`;

function extractOriginal(): boolean {
  const repo = resolve(import.meta.dirname, "..");
  const git = (command: string) => execSync("git " + command, { cwd: repo, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  let commit: string;
  try {
    commit = git("rev-parse --verify --quiet upstream/main");
  } catch {
    try {
      commit = git(`rev-parse --verify --quiet ${REDESIGN_BASE}`);
    } catch {
      return false;
    }
  }
  const marker = resolve(ORIGINAL_DIR, ".commit");
  if (existsSync(marker) && readFileSync(marker, "utf8") === commit) return true;
  rmSync(ORIGINAL_DIR, { recursive: true, force: true });
  mkdirSync(ORIGINAL_DIR, { recursive: true });
  execSync(`git archive ${commit} ui/index.html ui/src | tar -x -C "${ORIGINAL_DIR}" --strip-components=1`, { cwd: repo });
  writeFileSync(marker, commit);
  return true;
}

const original: Plugin = {
  name: "original",
  apply: "serve",
  async configureServer(server) {
    let inner: ViteDevServer | null = null;
    try {
      if (extractOriginal()) {
        inner = await createServer({
          configFile: false,
          root: ORIGINAL_DIR,
          base: "/original/",
          server: { middlewareMode: true, hmr: false, watch: null },
          plugins: [{ name: "back-link", transformIndexHtml: (html) => html.replace("</body>", BACK_LINK + "</body>") }],
          logLevel: "warn",
        });
        server.httpServer?.on("close", () => void inner?.close());
      }
    } catch (error) {
      console.warn("The original page could not be prepared:", error);
    }
    server.middlewares.use((request, response, next) => {
      const url = (request as { url?: string }).url ?? "";
      if (url === "/original") {
        response.statusCode = 302;
        response.setHeader("location", "/original/");
        response.end();
      } else if (url.startsWith("/original/")) {
        if (inner) inner.middlewares(request, response, next);
        else response.end("The original page needs this folder to be a git clone of the fork.");
      } else next();
    });
  },
};

// The dev server answers on its own port and hands every API request to the
// solax server running with the dev config.
export default defineConfig({
  plugins: [localDay, original],
  test: { exclude: ["**/node_modules/**", "**/.original/**", "e2e/**"] },
  build: { outDir: "dist", assetsDir: "assets", emptyOutDir: true },
  server: { watch: { ignored: ["**/.original/**"] }, proxy: { "/api": "http://127.0.0.1:8081", "/healthz": "http://127.0.0.1:8081" } },
});
