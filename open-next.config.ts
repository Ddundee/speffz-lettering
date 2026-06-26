import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

const config = defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});

// Build the Next.js app with `next build` directly. By default OpenNext builds
// it by running `npm run build` (see buildNextjsApp in @opennextjs/aws), but our
// `build` script *is* `opennextjs-cloudflare build` — without this override that
// recurses infinitely, exhausting memory locally and timing out on Cloudflare.
config.buildCommand = "next build";

export default config;
