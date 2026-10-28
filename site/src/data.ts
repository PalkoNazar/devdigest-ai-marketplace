// The catalog for this build, extracted once from the repository root.
import config from '../catalog.config.json';
import { buildCatalog, type CatalogConfig, type Artifact, type Plugin } from './lib/catalog.ts';

export const catalog = buildCatalog(process.env.CATALOG_ROOT ?? '..', config as CatalogConfig);
for (const w of catalog.warnings) console.warn(`[catalog] ${w}`);

export const pluginByName = new Map<string, Plugin>(catalog.plugins.map((p) => [p.name, p]));
export const artifactById = new Map<string, Artifact>(catalog.artifacts.map((a) => [a.id, a]));

/** Path under the site's base, e.g. url('setup/') → '/devdigest-ai-marketplace/setup/'. */
export function url(p = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${p.replace(/^\//, '')}`;
}

export const pluginUrl = (name: string) => url(`plugins/${name}/`);
/** The last segment of an artifact id: unique within its plugin and type, unlike the name (two hooks can share an event). */
export const artifactSlug = (a: Artifact) => a.id.slice(a.plugin.length + a.type.length + 2);
export const artifactUrl = (a: Artifact) => url(`plugins/${a.plugin}/${a.type}/${encodeURIComponent(artifactSlug(a))}/`);
export const repoUrl = `https://github.com/${catalog.marketplace.repo}`;
export const blobUrl = (p: string) => `${repoUrl}/blob/${config.branch}/${p}`;
export const requestUrl = (query: string) =>
  `${repoUrl}/issues/new?template=skill-request.yml&title=${encodeURIComponent(`Skill request: ${query}`)}&query=${encodeURIComponent(query)}`;
