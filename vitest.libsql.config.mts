import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.mts";

// Same suite, run through the libSQL client (the code Turso uses in production) against a local file.
export default mergeConfig(base, defineConfig({ test: { env: { MC_DRIVER: "libsql" } } }));
