import { defineConfig } from "vitest/config";
// Test files run one at a time: each full run re-runs HF 4.0, which hashes every step, and
// parallel files on a two-core CI runner slow every test by contention.
export default defineConfig({
  test: { include: ["test/**/*.test.ts"], passWithNoTests: true, fileParallelism: false },
});
