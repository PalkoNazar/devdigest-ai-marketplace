import MiniSearch from 'minisearch';
import { catalog } from '../data.ts';
import { searchOptions, type SearchDoc } from '../lib/search-options.ts';

export function GET() {
  const category = new Map(catalog.plugins.map((p) => [p.name, p.category ?? '']));
  const docs: SearchDoc[] = [
    ...catalog.artifacts.map((a) => ({
      id: a.id,
      type: a.type,
      plugin: a.plugin,
      category: category.get(a.plugin) ?? '',
      name: a.name,
      displayName: '',
      description: a.description,
      keywords: a.keywords.join(' '),
      tags: catalog.plugins.find((p) => p.name === a.plugin)?.tags.join(' ') ?? '',
      bodyText: a.bodyText ?? '',
    })),
    ...catalog.plugins.map((p) => ({
      id: `plugin:${p.name}`,
      type: 'plugin',
      plugin: p.name,
      category: p.category ?? '',
      name: p.name,
      displayName: p.displayName ?? '',
      description: p.description,
      keywords: p.keywords.join(' '),
      tags: p.tags.join(' '),
      bodyText: '',
    })),
  ];
  const index = new MiniSearch<SearchDoc>(searchOptions);
  index.addAll(docs);
  return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } });
}
