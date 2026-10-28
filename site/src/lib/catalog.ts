// Reads the marketplace in the repository and turns it into the catalog the site renders.
// Runs at build time only. Anything it can't parse throws: the catalog must never show
// less than the repository contains.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { renderMarkdown } from './markdown.ts';
import { trustOf, type Trust } from './trust.ts';

export type ArtifactType = 'skill' | 'agent' | 'command' | 'hook' | 'mcp' | 'monitor';
export const ARTIFACT_TYPES: ArtifactType[] = ['skill', 'agent', 'command', 'hook', 'mcp', 'monitor'];

export type CatalogConfig = {
  publishContent: 'full' | 'metadata';
  repo: string;
  branch: string;
};

export type Artifact = {
  id: string;
  type: ArtifactType;
  plugin: string;
  name: string;
  description: string;
  keywords: string[];
  invocation?: string;
  bodyHtml?: string;
  bodyText?: string;
  sourcePath: string;
};

export type Plugin = {
  name: string;
  displayName?: string;
  version?: string;
  description: string;
  category?: string;
  tags: string[];
  keywords: string[];
  author?: { name: string; url?: string };
  license?: string;
  homepage?: string;
  dependencies: string[];
  external: boolean;
  sourcePath?: string;
  readmeHtml?: string;
  latestChange?: { version: string; html: string };
  trust: Trust;
  artifactIds: string[];
};

export type Catalog = {
  schemaVersion: 1;
  marketplace: { name: string; description: string; repo: string; owner: string };
  publishContent: CatalogConfig['publishContent'];
  generatedAt: string;
  commit: string;
  plugins: Plugin[];
  artifacts: Artifact[];
  warnings: string[];
};

type Json = any;

const BODY_TEXT_LIMIT = 2000;
const CATALOG_METADATA_KEYS = new Set(['minClaudeCodeVersion', 'artifacts']);

export function buildCatalog(root: string, config: CatalogConfig): Catalog {
  const marketplace = readJson(path.join(root, '.claude-plugin/marketplace.json'));
  const name: string = marketplace.name;
  const pluginRoot: string | undefined = marketplace.metadata?.pluginRoot;
  const changelog = readChangelog(root, config);
  const warnings: string[] = [];
  const plugins: Plugin[] = [];
  const artifacts: Artifact[] = [];

  for (const entry of marketplace.plugins ?? []) {
    const dir = localSourceDir(root, entry.source, pluginRoot);
    if (!dir) {
      plugins.push(externalPlugin(entry, name));
      continue;
    }
    const result = readPlugin(root, dir, entry, name, config, warnings);
    result.plugin.latestChange = changelog.get(result.plugin.name);
    plugins.push(result.plugin);
    artifacts.push(...result.artifacts);
  }

  plugins.sort((a, b) => a.name.localeCompare(b.name));
  artifacts.sort((a, b) => a.id.localeCompare(b.id));

  return {
    schemaVersion: 1,
    marketplace: {
      name,
      description: marketplace.description ?? marketplace.metadata?.description ?? '',
      repo: config.repo,
      owner: marketplace.owner?.name ?? '',
    },
    publishContent: config.publishContent,
    generatedAt: new Date().toISOString(),
    commit: gitCommit(root),
    plugins,
    artifacts,
    warnings,
  };
}

function localSourceDir(root: string, source: Json, pluginRoot?: string): string | null {
  if (typeof source !== 'string') return null;
  let rel = source;
  if (!rel.startsWith('./') && rel !== '.' && pluginRoot && !rel.includes('/')) {
    rel = path.posix.join(pluginRoot, rel);
  }
  const dir = path.resolve(root, rel);
  if (!existsSync(dir)) throw new Error(`Plugin source does not exist: ${source}`);
  return dir;
}

function externalPlugin(entry: Json, marketplace: string): Plugin {
  return {
    name: entry.name,
    displayName: entry.displayName,
    version: entry.version,
    description: entry.description ?? '',
    category: entry.category,
    tags: entry.tags ?? [],
    keywords: entry.keywords ?? [],
    author: entry.author,
    license: entry.license,
    homepage: entry.homepage,
    dependencies: normalizeDependencies(entry.dependencies, marketplace),
    external: true,
    trust: trustOf({}),
    artifactIds: [],
  };
}

function readPlugin(
  root: string,
  dir: string,
  entry: Json,
  marketplace: string,
  config: CatalogConfig,
  warnings: string[],
): { plugin: Plugin; artifacts: Artifact[] } {
  const manifestPath = path.join(dir, '.claude-plugin/plugin.json');
  const manifest: Json = existsSync(manifestPath) ? readJson(manifestPath) : {};
  // The entry name is the install id; components are namespaced under the manifest name.
  const id: string = entry.name;
  const prefix: string = manifest.name ?? entry.name;
  const catalogMeta: Json = manifest.metadata?.catalog ?? {};
  for (const key of Object.keys(catalogMeta)) {
    if (!CATALOG_METADATA_KEYS.has(key)) warnings.push(`${id}: unknown metadata.catalog key "${key}"`);
  }
  const keywordsFor = (key: string): string[] => catalogMeta.artifacts?.[key]?.keywords ?? [];
  const full = config.publishContent === 'full';
  const rel = (file: string) => path.relative(root, file).split(path.sep).join('/');
  const ctx: Ctx = { id, prefix, dir, full, rel, keywordsFor, repo: config.repo, branch: config.branch };

  const skills = readSkills(ctx, manifest);
  const agents = readAgents(ctx, manifest);
  const commands = readCommands(ctx, manifest);
  const hooks = readHooks(ctx, manifest, entry);
  const mcpServers = readMcpServers(ctx, manifest);
  const monitors = readMonitors(ctx, manifest);
  const bin = listFiles(path.join(dir, 'bin')).map((f) => path.relative(dir, f).split(path.sep).join('/'));

  const artifacts = [
    ...skills.map((s) => s.artifact),
    ...agents.map((a) => a.artifact),
    ...commands.map((c) => c.artifact),
    ...hooks.map((h) => h.artifact),
    ...mcpServers.map((m) => m.artifact),
    ...monitors.map((m) => m.artifact),
  ];
  uniqueIds(artifacts);

  const trust = trustOf({
    hooks: hooks.map((h) => h.info),
    mcpServers: mcpServers.map((m) => m.info),
    monitors: monitors.map((m) => m.info),
    bin,
    userConfig: Object.entries(manifest.userConfig ?? {}).map(([key, o]: [string, Json]) => ({
      key,
      title: o.title ?? key,
      required: Boolean(o.required),
      sensitive: Boolean(o.sensitive),
    })),
    toolAccess: [...skills, ...agents, ...commands]
      .filter((x) => x.tools.length > 0)
      .map((x) => ({ name: x.artifact.name, tools: x.tools })),
    minClaudeCodeVersion: catalogMeta.minClaudeCodeVersion,
    dependencies: normalizeDependencies(manifest.dependencies ?? entry.dependencies, marketplace),
    sources: [
      existsSync(manifestPath) ? rel(manifestPath) : null,
      ...hooks.map((h) => h.artifact.sourcePath),
      ...mcpServers.map((m) => m.artifact.sourcePath),
    ].filter((x, i, all): x is string => Boolean(x) && all.indexOf(x) === i),
  });

  const readme = path.join(dir, 'README.md');
  // Display fields set on the entry win over plugin.json, except version.
  const pick = (key: string) => entry[key] ?? manifest[key];
  const plugin: Plugin = {
    name: id,
    displayName: pick('displayName'),
    version: manifest.version ?? entry.version,
    description: pick('description') ?? '',
    category: entry.category,
    tags: entry.tags ?? [],
    keywords: pick('keywords') ?? [],
    author: pick('author'),
    license: pick('license'),
    homepage: pick('homepage'),
    dependencies: trust.dependencies,
    external: false,
    sourcePath: rel(dir),
    readmeHtml: full && existsSync(readme) ? renderMarkdown(readFileSync(readme, 'utf8'), blobBase(ctx, readme)) : undefined,
    trust,
    artifactIds: artifacts.map((a) => a.id),
  };
  return { plugin, artifacts };
}

type Ctx = {
  id: string;
  prefix: string;
  dir: string;
  full: boolean;
  rel: (file: string) => string;
  keywordsFor: (key: string) => string[];
  repo: string;
  branch: string;
};

type WithTools = { artifact: Artifact; tools: string[] };

function markdownArtifact(
  ctx: Ctx,
  type: ArtifactType,
  file: string,
  fallbackName: string,
  invocation: (name: string) => string,
): WithTools {
  const { data, body } = readFrontmatter(file);
  const name = String(data.name ?? fallbackName);
  return {
    artifact: {
      id: `${ctx.id}/${type}/${name}`,
      type,
      plugin: ctx.id,
      name,
      description: String(data.description ?? ''),
      keywords: ctx.keywordsFor(`${type}/${name}`),
      invocation: invocation(name),
      bodyHtml: ctx.full ? renderMarkdown(body, blobBase(ctx, file)) : undefined,
      bodyText: ctx.full ? plainText(body) : undefined,
      sourcePath: ctx.rel(file),
    },
    tools: toolList(data['allowed-tools'] ?? data.tools),
  };
}

function readSkills(ctx: Ctx, manifest: Json): WithTools[] {
  const dirs = new Set<string>();
  const addSkillsDir = (d: string) => {
    if (existsSync(path.join(d, 'SKILL.md'))) {
      dirs.add(d);
      return;
    }
    for (const child of subdirs(d)) if (existsSync(path.join(child, 'SKILL.md'))) dirs.add(child);
  };
  const defaultDir = path.join(ctx.dir, 'skills');
  if (existsSync(defaultDir)) addSkillsDir(defaultDir);
  for (const p of asArray(manifest.skills)) addSkillsDir(componentPath(ctx, p));
  // A plugin with SKILL.md at its root, no skills/ and no skills key loads as one skill.
  if (dirs.size === 0 && !manifest.skills && existsSync(path.join(ctx.dir, 'SKILL.md'))) dirs.add(ctx.dir);
  return [...dirs].map((d) =>
    markdownArtifact(ctx, 'skill', path.join(d, 'SKILL.md'), path.basename(d), (n) => `/${ctx.prefix}:${n}`),
  );
}

function readAgents(ctx: Ctx, manifest: Json): WithTools[] {
  const files = manifest.agents
    ? asArray(manifest.agents).map((p) => componentPath(ctx, p))
    : listFiles(path.join(ctx.dir, 'agents')).filter((f) => f.endsWith('.md'));
  return files.map((f) =>
    markdownArtifact(ctx, 'agent', f, path.basename(f, '.md'), (n) => `${ctx.prefix}:${n}`),
  );
}

function readCommands(ctx: Ctx, manifest: Json): WithTools[] {
  const spec = manifest.commands;
  const fromFile = (f: string, name = path.basename(f, '.md')) =>
    markdownArtifact(ctx, 'command', f, name, (n) => `/${ctx.prefix}:${n}`);
  if (spec && typeof spec === 'object' && !Array.isArray(spec)) {
    return Object.entries(spec).map(([name, c]: [string, Json]) => {
      if (c.source) {
        const result = fromFile(componentPath(ctx, c.source), name);
        result.artifact.name = name;
        result.artifact.id = `${ctx.id}/command/${name}`;
        result.artifact.invocation = `/${ctx.prefix}:${name}`;
        if (c.description) result.artifact.description = c.description;
        return result;
      }
      return {
        artifact: {
          id: `${ctx.id}/command/${name}`,
          type: 'command' as const,
          plugin: ctx.id,
          name,
          description: c.description ?? '',
          keywords: ctx.keywordsFor(`command/${name}`),
          invocation: `/${ctx.prefix}:${name}`,
          bodyHtml: ctx.full && c.content ? renderMarkdown(c.content, '') : undefined,
          bodyText: ctx.full && c.content ? plainText(c.content) : undefined,
          sourcePath: ctx.rel(path.join(ctx.dir, '.claude-plugin/plugin.json')),
        },
        tools: toolList(c.allowedTools),
      };
    });
  }
  const paths = spec ? asArray(spec).map((p) => componentPath(ctx, p)) : [path.join(ctx.dir, 'commands')];
  return paths
    .flatMap((p) => (existsSync(p) && statSync(p).isDirectory() ? listFiles(p, false) : [p]))
    .filter((f) => f.endsWith('.md'))
    .map((f) => fromFile(f));
}

export type HookInfo = { event: string; matcher?: string; form: 'exec' | 'shell' | string; command: string };

function readHooks(ctx: Ctx, manifest: Json, entry: Json) {
  const out: { artifact: Artifact; info: HookInfo }[] = [];
  const add = (config: Json, file: string, description?: string) => {
    for (const [event, groups] of Object.entries(config ?? {})) {
      for (const group of asArray(groups as Json)) {
        for (const h of asArray(group.hooks)) {
          const command =
            h.type === 'command'
              ? [h.command, ...(h.args ?? [])].filter(Boolean).join(' ')
              : h.prompt ?? h.url ?? h.type;
          const form = h.type === 'command' ? (h.args ? 'exec' : 'shell') : h.type;
          const info: HookInfo = { event, matcher: group.matcher, form, command };
          const name = group.matcher ? `${event} ${group.matcher}` : event;
          out.push({
            info,
            artifact: {
              id: `${ctx.id}/hook/${slug(name)}`,
              type: 'hook',
              plugin: ctx.id,
              name: event,
              description:
                description ??
                `Runs on ${event}${group.matcher ? ` for ${group.matcher}` : ''}: ${command}`,
              keywords: ctx.keywordsFor(`hook/${event}`),
              sourcePath: file,
            },
          });
        }
      }
    }
  };
  const fromFile = (file: string) => {
    const json = readJson(file);
    if (!json.hooks) throw new Error(`${ctx.rel(file)}: hooks file must wrap the events in a "hooks" key`);
    add(json.hooks, ctx.rel(file), json.description);
  };
  const defaultFile = path.join(ctx.dir, 'hooks/hooks.json');
  if (existsSync(defaultFile)) fromFile(defaultFile);
  const manifestFile = ctx.rel(path.join(ctx.dir, '.claude-plugin/plugin.json'));
  for (const h of asArray(manifest.hooks)) {
    if (typeof h === 'string') fromFile(componentPath(ctx, h));
    else add(h, manifestFile);
  }
  if (entry.hooks && typeof entry.hooks === 'object' && !Array.isArray(entry.hooks)) {
    add(entry.hooks, '.claude-plugin/marketplace.json');
  }
  return out;
}

export type McpInfo = {
  name: string;
  transport: string;
  command?: string;
  url?: string;
  host?: string;
  env: string[];
};

function readMcpServers(ctx: Ctx, manifest: Json) {
  const servers = new Map<string, { info: McpInfo; file: string }>();
  const add = (map: Json, file: string) => {
    for (const [name, s] of Object.entries(map ?? {}) as [string, Json][]) {
      const transport = s.type ?? (s.url ? 'http' : 'stdio');
      const info: McpInfo = {
        name,
        transport,
        command: s.command ? [s.command, ...(s.args ?? [])].join(' ') : undefined,
        url: s.url,
        host: s.url ? hostOf(s.url) : undefined,
        env: Object.keys(s.env ?? {}),
      };
      servers.set(name, { info, file });
    }
  };
  const fromFile = (file: string) => {
    const json = readJson(file);
    add(json.mcpServers ?? json, ctx.rel(file));
  };
  const defaultFile = path.join(ctx.dir, '.mcp.json');
  if (existsSync(defaultFile)) fromFile(defaultFile);
  const manifestFile = ctx.rel(path.join(ctx.dir, '.claude-plugin/plugin.json'));
  for (const m of asArray(manifest.mcpServers)) {
    if (typeof m !== 'string') add(m, manifestFile);
    else if (/\.(mcpb|dxt)$/.test(m)) {
      const name = path.basename(m).replace(/\.(mcpb|dxt)$/, '');
      servers.set(name, {
        info: { name, transport: 'bundle', command: m, url: /^https:/.test(m) ? m : undefined, host: /^https:/.test(m) ? hostOf(m) : undefined, env: [] },
        file: manifestFile,
      });
    } else fromFile(componentPath(ctx, m));
  }
  return [...servers.values()].map(({ info, file }) => ({
    info,
    artifact: {
      id: `${ctx.id}/mcp/${info.name}`,
      type: 'mcp' as const,
      plugin: ctx.id,
      name: info.name,
      description:
        info.transport === 'stdio'
          ? `Local MCP server: ${info.command}`
          : `${info.transport} MCP server${info.host ? ` at ${info.host}` : ''}`,
      keywords: ctx.keywordsFor(`mcp/${info.name}`),
      sourcePath: file,
    },
  }));
}

export type MonitorInfo = { name: string; command: string; description: string; when: string };

function readMonitors(ctx: Ctx, manifest: Json) {
  const spec = manifest.experimental?.monitors ?? manifest.monitors;
  let list: Json[] = [];
  let file = ctx.rel(path.join(ctx.dir, '.claude-plugin/plugin.json'));
  if (Array.isArray(spec)) list = spec;
  else {
    const p = typeof spec === 'string' ? componentPath(ctx, spec) : path.join(ctx.dir, 'monitors/monitors.json');
    if (existsSync(p)) {
      list = asArray(readJson(p));
      file = ctx.rel(p);
    }
  }
  return list.map((m) => ({
    info: { name: m.name, command: m.command, description: m.description ?? '', when: m.when ?? 'always' } as MonitorInfo,
    artifact: {
      id: `${ctx.id}/monitor/${m.name}`,
      type: 'monitor' as const,
      plugin: ctx.id,
      name: m.name,
      description: m.description ?? '',
      keywords: ctx.keywordsFor(`monitor/${m.name}`),
      sourcePath: file,
    },
  }));
}

function readChangelog(root: string, config: CatalogConfig): Map<string, { version: string; html: string }> {
  const file = path.join(root, 'CHANGELOG.md');
  const out = new Map<string, { version: string; html: string }>();
  if (!existsSync(file)) return out;
  const sections = readFileSync(file, 'utf8').split(/^## /m).slice(1);
  for (const section of sections) {
    const [heading, ...rest] = section.split('\n');
    const m = heading.trim().match(/^(\S+)\s+(\S+)$/);
    if (!m || out.has(m[1])) continue;
    const body = rest.join('\n').replace(/^###\s+/gm, '#### ');
    out.set(m[1], { version: m[2], html: renderMarkdown(body, `https://github.com/${config.repo}/blob/${config.branch}/`) });
  }
  return out;
}

export function readFrontmatter(file: string): { data: Json; body: string } {
  const text = readFileSync(file, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: text };
  let data: Json;
  try {
    data = parseYaml(m[1]) ?? {};
  } catch (e) {
    throw new Error(`Invalid frontmatter in ${file}: ${(e as Error).message}`);
  }
  if (typeof data !== 'object' || Array.isArray(data)) throw new Error(`Invalid frontmatter in ${file}: not a mapping`);
  return { data, body: text.slice(m[0].length) };
}

function readJson(file: string): Json {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`Invalid JSON in ${file}: ${(e as Error).message}`);
  }
}

function componentPath(ctx: Ctx, p: string): string {
  const resolved = path.resolve(ctx.dir, p);
  if (resolved !== ctx.dir && !resolved.startsWith(ctx.dir + path.sep)) throw new Error(`${ctx.id}: path escapes plugin directory: ${p}`);
  if (!existsSync(resolved)) throw new Error(`${ctx.id}: path not found: ${p}`);
  return resolved;
}

function normalizeDependencies(deps: Json, marketplace: string): string[] {
  return asArray(deps).map((d) => {
    if (typeof d === 'string') return d.includes('@') ? d : `${d}@${marketplace}`;
    return `${d.name}@${d.marketplace ?? marketplace}`;
  });
}

function toolList(v: Json): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  return String(v).split(',').map((s) => s.trim()).filter(Boolean);
}

function uniqueIds(artifacts: Artifact[]) {
  const seen = new Map<string, number>();
  for (const a of artifacts) {
    const n = (seen.get(a.id) ?? 0) + 1;
    seen.set(a.id, n);
    if (n > 1) a.id = `${a.id}-${n}`;
  }
}

function blobBase(ctx: Ctx, file: string): string {
  return `https://github.com/${ctx.repo}/blob/${ctx.branch}/${path.posix.dirname(ctx.rel(file))}/`;
}

function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`\[\]()|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, BODY_TEXT_LIMIT);
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url.replace(/\$\{[^}]+\}/g, 'x')).host;
  } catch {
    return undefined;
  }
}

function slug(s: string): string {
  return s.replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^-|-$/g, '');
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function subdirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(dir, d.name))
    .sort();
}

function listFiles(dir: string, recursive = true): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) {
      if (recursive) out.push(...listFiles(p));
    } else out.push(p);
  }
  return out.sort();
}

function gitCommit(root: string): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}
