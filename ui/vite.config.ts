import { createReadStream, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

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

// The dev server answers on its own port and hands every API request to the
// solax server running with the dev config.
export default defineConfig({
  plugins: [localDay],
  build: { outDir: "dist", assetsDir: "assets", emptyOutDir: true },
  server: { proxy: { "/api": "http://127.0.0.1:8081", "/healthz": "http://127.0.0.1:8081" } },
});
