import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  server: {
    host: true, // bind to 0.0.0.0 — required for Railway
  },
  security: {
    checkOrigin: false,
  },
});
