import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

// The catalog is read from the repository this site lives in.
process.env.CATALOG_ROOT ??= fileURLToPath(new URL('..', import.meta.url));

// Served as a GitHub Pages project site: https://palkonazar.github.io/devdigest-ai-marketplace/
// SITE_BASE overrides the path, e.g. "/" for a custom domain.
export default defineConfig({
  site: 'https://palkonazar.github.io',
  base: process.env.SITE_BASE ?? '/devdigest-ai-marketplace',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
