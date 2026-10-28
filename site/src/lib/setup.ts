// Settings generator: the plugins a team picks → settings JSON and CLI commands.

export type SetupPlugin = { name: string; dependencies: string[] };
export type Target = 'project' | 'managed';

export type SetupInput = {
  marketplace: string;
  repo: string;
  plugins: SetupPlugin[];
  selected: string[];
  target: Target;
  autoUpdate: boolean;
};

/** Selected plugins plus every dependency in this marketplace, transitively. */
export function effectiveSelection(plugins: SetupPlugin[], selected: string[], marketplace: string): Set<string> {
  const byName = new Map(plugins.map((p) => [p.name, p]));
  const out = new Set<string>();
  const visit = (name: string) => {
    if (out.has(name) || !byName.has(name)) return;
    out.add(name);
    for (const dep of byName.get(name)!.dependencies) {
      const [depName, depMarketplace] = dep.split('@');
      if (!depMarketplace || depMarketplace === marketplace) visit(depName);
    }
  };
  selected.forEach(visit);
  return out;
}

/** For each plugin pulled in only as a dependency, the selected plugins that need it. */
export function requiredBy(plugins: SetupPlugin[], selected: string[], marketplace: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const name of selected) {
    for (const dep of effectiveSelection(plugins, [name], marketplace)) {
      if (dep === name || selected.includes(dep)) continue;
      out.set(dep, [...(out.get(dep) ?? []), name]);
    }
  }
  return out;
}

export function settingsFor(input: SetupInput): { json: string; cli: string; fileLabel: string } {
  const enabled = effectiveSelection(input.plugins, input.selected, input.marketplace);
  const names = input.plugins.map((p) => p.name).filter((n) => enabled.has(n));
  const entry: Record<string, unknown> = { source: { source: 'github', repo: input.repo } };
  if (input.target === 'managed' && input.autoUpdate) entry.autoUpdate = true;
  const settings = {
    extraKnownMarketplaces: { [input.marketplace]: entry },
    enabledPlugins: Object.fromEntries(names.map((n) => [`${n}@${input.marketplace}`, true])),
  };
  const cli = [
    `claude plugin marketplace add ${input.repo}`,
    ...names.map((n) => `claude plugin install ${n}@${input.marketplace}`),
  ].join('\n');
  return {
    json: JSON.stringify(settings, null, 2),
    cli,
    fileLabel: input.target === 'managed' ? 'managed-settings.json' : '.claude/settings.json',
  };
}
