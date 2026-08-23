// GitHub Pages project sites (https://user.github.io/repo-name/) serve the
// app from a subpath, not the domain root. Every hardcoded absolute path in
// the app (service worker registration, sql.js wasm loading) must be
// prefixed with this, or those requests silently 404 once deployed there.
//
// Set NEXT_PUBLIC_BASE_PATH="/your-repo-name" as a build-time env var when
// deploying to a GitHub Pages project site. Leave it unset (empty string)
// for a custom domain, a GitHub Pages *user/org* site, or when just opening
// index.html directly / running `npm run serve` locally.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
