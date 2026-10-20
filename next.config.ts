import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  // The database path is computed at runtime; never copy a local .db into the build output.
  outputFileTracingExcludes: { "*": ["./data/**/*"] },
  poweredByHeader: false,
};

export default config;
