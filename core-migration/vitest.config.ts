import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Archivos grandes (CRM ~444 MB) tardan ~30 s; otros <5 s.
    testTimeout: 120_000,
    hookTimeout: 30_000,
  },
});
