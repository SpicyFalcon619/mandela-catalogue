import type { NextConfig } from "next";

const config: NextConfig = {
  // Docker runs the standalone server; Vercel does its own packaging and must not use this.
  output: process.env.VERCEL ? undefined : "standalone",
  serverExternalPackages: ["better-sqlite3"],
  // The database path is computed at runtime; never copy a local .db into the build output.
  outputFileTracingExcludes: { "*": ["./data/**/*"] },
  poweredByHeader: false,
};

export default config;
