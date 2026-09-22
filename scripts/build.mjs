import { execSync } from "node:child_process";

// OpenNext calls `npm run build` after setting NEXT_PRIVATE_STANDALONE.
// In that inner pass, only compile Next.js. The outer pass (CI / Cloudflare
// Workers Builds) must run OpenNext so `.open-next/` exists for wrangler deploy.
const command =
  process.env.NEXT_PRIVATE_STANDALONE === "true"
    ? "next build"
    : "opennextjs-cloudflare build";

execSync(command, { stdio: "inherit" });
