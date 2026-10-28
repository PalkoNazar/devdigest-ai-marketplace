import { catalog } from '../data.ts';

// Machine-readable catalog: the same data the site renders, without rendered HTML.
export function GET() {
  const { warnings: _, ...rest } = catalog;
  const out = {
    ...rest,
    plugins: catalog.plugins.map(({ readmeHtml: _r, latestChange, ...p }) => ({
      ...p,
      latestChange: latestChange ? { version: latestChange.version } : undefined,
    })),
    artifacts: catalog.artifacts.map(({ bodyHtml: _b, ...a }) => a),
  };
  return new Response(JSON.stringify(out, null, 2), { headers: { 'Content-Type': 'application/json' } });
}
