// Runs after `next build` (which produces the static export in ./out because
// next.config.ts sets output: "export"). Walks every file in ./out and writes
// a manifest listing them all, so the service worker can precache the exact
// content-hashed JS/CSS chunk filenames Next.js generated for this build —
// without us having to hardcode or guess them.
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const OUT_DIR = new URL("../out", import.meta.url).pathname;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else {
      const rel = relative(OUT_DIR, full).split(sep).join("/");
      files.push("/" + rel);
    }
  }
  return files;
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const files = walk(OUT_DIR)
  .filter((f) => f !== "/sw-precache-manifest.json")
  .map((f) => `${basePath}${f}`);
writeFileSync(join(OUT_DIR, "sw-precache-manifest.json"), JSON.stringify(files, null, 0));
console.log(`Wrote sw-precache-manifest.json with ${files.length} files (basePath: "${basePath}").`);
