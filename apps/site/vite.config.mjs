import { resolve } from "node:path";

import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        en: resolve(import.meta.dirname, "index.html"),
        ja: resolve(import.meta.dirname, "ja/index.html"),
      },
    },
  },
});
