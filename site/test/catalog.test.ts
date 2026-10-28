import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCatalog, type CatalogConfig } from '../src/lib/catalog.ts';

const fixture = (name: string) => path.join(__dirname, 'fixtures', name);
const config = (publishContent: CatalogConfig['publishContent'] = 'full'): CatalogConfig => ({
  publishContent,
  repo: 'owner/repo',
  branch: 'main',
});

describe('buildCatalog', () => {
  const catalog = buildCatalog(fixture('market'), config());
  const ids = catalog.artifacts.map((a) => a.id);
  const byId = (id: string) => catalog.artifacts.find((a) => a.id === id)!;
  const plugin = (name: string) => catalog.plugins.find((p) => p.name === name)!;

  it('reads every component of a default-layout plugin', () => {
    expect(ids).toEqual(
      expect.arrayContaining([
        'tools/skill/review-pr',
        'tools/agent/reviewer',
        'tools/command/lint',
        'tools/hook/PostToolUse-Edit-Write',
        'tools/mcp/git-local',
        'tools/mcp/remote',
      ]),
    );
    expect(byId('tools/skill/review-pr')).toMatchObject({
      invocation: '/tools:review-pr',
      keywords: ['code review', 'pull request'],
      sourcePath: 'plugins/tools/skills/review-pr/SKILL.md',
    });
    expect(byId('tools/agent/reviewer').invocation).toBe('tools:reviewer');
  });

  it('follows manifest path rules: commands and agents replace, skills add', () => {
    const custom = ids.filter((id) => id.startsWith('custom/'));
    expect(custom).toEqual(['custom/agent/a', 'custom/command/about', 'custom/command/status', 'custom/skill/deep']);
    // Components are namespaced under the manifest name, installed under the entry name.
    expect(byId('custom/skill/deep').invocation).toBe('/custom-tools:deep');
    expect(byId('custom/command/status').description).toBe('Show status');
  });

  it('names a skill after its directory when frontmatter has no name', () => {
    expect(byId('shared/skill/fragments').description).toBe('Prompt fragments.');
  });

  it('lists external plugins with entry metadata only', () => {
    expect(plugin('ext')).toMatchObject({ external: true, description: 'External plugin', artifactIds: [] });
  });

  it('builds the trust summary from hooks, MCP servers, bin and userConfig', () => {
    const t = plugin('tools').trust;
    expect(t.level).toBe('network');
    expect(t.asksForSecrets).toBe(true);
    expect(t.networkHosts).toEqual(['api.example.com']);
    expect(t.bin).toEqual(['bin/tool']);
    expect(t.hooks[0]).toMatchObject({ event: 'PostToolUse', matcher: 'Edit|Write', form: 'exec' });
    expect(t.mcpServers.find((s) => s.name === 'git-local')!.env).toEqual(['GITHUB_TOKEN']);
    expect(t.toolAccess).toEqual([
      { name: 'review-pr', tools: ['Read', 'Grep', 'Bash(git diff:*)'] },
      { name: 'reviewer', tools: ['Read', 'Grep'] },
    ]);
    expect(t.minClaudeCodeVersion).toBe('2.1.300');
    expect(t.dependencies).toEqual(['shared@fixture']);
    expect(plugin('shared').trust.level).toBe('content-only');
  });

  it('takes the latest changelog entry per plugin', () => {
    expect(plugin('tools').latestChange?.version).toBe('1.2.0');
    expect(plugin('tools').latestChange?.html).toContain('review-pr');
  });

  it('warns about unknown metadata.catalog keys', () => {
    expect(catalog.warnings).toEqual(['tools: unknown metadata.catalog key "typo"']);
  });

  it('sanitizes rendered bodies and points relative links at GitHub', () => {
    const html = byId('tools/skill/review-pr').bodyHtml!;
    expect(html).not.toMatch(/<script|onerror|javascript:/);
    expect(html).toContain('href="https://github.com/owner/repo/blob/main/plugins/tools/README.md"');
  });

  it('publishes no bodies in metadata mode', () => {
    const meta = buildCatalog(fixture('market'), config('metadata'));
    expect(meta.artifacts.every((a) => a.bodyHtml === undefined && a.bodyText === undefined)).toBe(true);
    expect(meta.plugins.every((p) => p.readmeHtml === undefined)).toBe(true);
  });

  it('fails the build on frontmatter it cannot parse', () => {
    expect(() => buildCatalog(fixture('broken'), config())).toThrow(/Invalid frontmatter/);
  });
});
