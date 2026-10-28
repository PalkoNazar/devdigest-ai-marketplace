import { describe, expect, it } from 'vitest';
import { effectiveSelection, requiredBy, settingsFor } from '../src/lib/setup.ts';

const plugins = [
  { name: 'a', dependencies: ['b@m'] },
  { name: 'b', dependencies: ['c'] },
  { name: 'c', dependencies: [] },
  { name: 'd', dependencies: ['x@other'] },
];

describe('setup generator', () => {
  it('pulls in dependencies transitively, only from this marketplace', () => {
    expect([...effectiveSelection(plugins, ['a'], 'm')].sort()).toEqual(['a', 'b', 'c']);
    expect([...effectiveSelection(plugins, ['d'], 'm')]).toEqual(['d']);
  });

  it('reports which selected plugins require a dependency', () => {
    expect(requiredBy(plugins, ['a'], 'm')).toEqual(new Map([['b', ['a']], ['c', ['a']]]));
    expect(requiredBy(plugins, ['a', 'b'], 'm').has('b')).toBe(false);
  });

  it('writes project settings and CLI commands', () => {
    const out = settingsFor({ marketplace: 'm', repo: 'o/r', plugins, selected: ['b'], target: 'project', autoUpdate: true });
    expect(JSON.parse(out.json)).toEqual({
      extraKnownMarketplaces: { m: { source: { source: 'github', repo: 'o/r' } } },
      enabledPlugins: { 'b@m': true, 'c@m': true },
    });
    expect(out.cli).toBe('claude plugin marketplace add o/r\nclaude plugin install b@m\nclaude plugin install c@m');
    expect(out.fileLabel).toBe('.claude/settings.json');
  });

  it('adds autoUpdate only to managed settings', () => {
    const managed = settingsFor({ marketplace: 'm', repo: 'o/r', plugins, selected: [], target: 'managed', autoUpdate: true });
    expect(JSON.parse(managed.json).extraKnownMarketplaces.m.autoUpdate).toBe(true);
    expect(managed.fileLabel).toBe('managed-settings.json');
  });
});
