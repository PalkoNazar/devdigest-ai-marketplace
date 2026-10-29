// Home page search: query → MiniSearch → show, order and highlight the server-rendered cards.
import MiniSearch from 'minisearch';
import { parseQuery } from '../lib/query.ts';
import { searchBoost, searchOptions, type SearchDoc } from '../lib/search-options.ts';

const PAGE_SIZE = 20;
const TYPE_NAMES: Record<string, [string, string]> = {
  skill: ['skill', 'skills'],
  agent: ['agent', 'agents'],
  command: ['command', 'commands'],
  hook: ['hook', 'hooks'],
  mcp: ['MCP server', 'MCP servers'],
  monitor: ['monitor', 'monitors'],
  plugin: ['plugin', 'plugins'],
};

const form = document.getElementById('search') as HTMLFormElement;
const config = JSON.parse(form.dataset.config!) as { indexUrl: string; requestBase: string; total: number };
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const input = $<HTMLInputElement>('q')!;
const typeSelect = $<HTMLSelectElement>('type')!;
const pluginSelect = $<HTMLSelectElement>('plugin')!;
const categorySelect = $<HTMLSelectElement>('category');
const chip = $<HTMLButtonElement>('type-chip')!;
const chipNote = $('type-note')!;
const count = $('count')!;
const list = $<HTMLUListElement>('results')!;
const more = $<HTMLButtonElement>('more')!;
const empty = $('empty')!;
const notIt = $('not-it')!;
const browse = $('browse')!;

const cards = new Map<string, HTMLLIElement>();
for (const li of list.querySelectorAll<HTMLLIElement>(':scope > li')) {
  cards.set(li.dataset.id!, li);
  for (const el of li.querySelectorAll<HTMLElement>('[data-hl]')) el.dataset.text = el.textContent ?? '';
}
const initialOrder = [...cards.keys()];

// Type filter state: a type the user picked, or one taken from the words of the query.
let manualType = '';
let hintDismissed = '';
let shown = PAGE_SIZE;
let index: MiniSearch<SearchDoc> | null = null;

async function loadIndex() {
  if (index) return index;
  const res = await fetch(config.indexUrl);
  index = MiniSearch.loadJSON<SearchDoc>(await res.text(), searchOptions);
  return index;
}

function readUrl() {
  const p = new URLSearchParams(location.search);
  input.value = p.get('q') ?? '';
  manualType = p.get('type') ?? '';
  pluginSelect.value = p.get('plugin') ?? '';
  if (categorySelect) categorySelect.value = p.get('category') ?? '';
}

function writeUrl() {
  const p = new URLSearchParams();
  if (input.value.trim()) p.set('q', input.value.trim());
  if (manualType) p.set('type', manualType);
  if (pluginSelect.value) p.set('plugin', pluginSelect.value);
  if (categorySelect?.value) p.set('category', categorySelect.value);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

async function run() {
  const parsed = parseQuery(input.value);
  if (parsed.typeWord !== hintDismissed) hintDismissed = '';
  const hinted = !manualType && parsed.type && !hintDismissed ? parsed.type : '';
  const type = manualType || hinted;
  const plugin = pluginSelect.value;
  const category = categorySelect?.value ?? '';
  typeSelect.value = type;

  chip.hidden = !type;
  if (type) chip.querySelector('span')!.textContent = `Type: ${TYPE_NAMES[type]?.[0] ?? type}`;
  chip.setAttribute('aria-label', `Remove filter: type ${type}`);
  chipNote.hidden = !hinted;
  chipNote.textContent = hinted ? `from “${parsed.typeWord}” in your request` : '';

  const passes = (id: string, docType: string, docPlugin: string, docCategory: string) =>
    (!type || docType === type) && (!plugin || docPlugin === plugin) && (!category || docCategory === category);

  let ids: string[];
  let terms: string[] = [];
  if (parsed.terms.length === 0) {
    ids = initialOrder.filter((id) => {
      const li = cards.get(id)!;
      return passes(id, li.dataset.type!, li.dataset.plugin!, li.dataset.category!);
    });
  } else {
    const ms = await loadIndex();
    const results = ms.search(parsed.terms.join(' '), {
      boost: searchBoost,
      prefix: true,
      fuzzy: (term) => (term.length > 4 ? 0.2 : false),
      combineWith: 'OR',
      filter: (r) => passes(r.id, r.type, r.plugin, r.category),
    });
    ids = results.map((r) => r.id);
    terms = [...new Set(results.flatMap((r) => r.terms))];
  }

  render(ids, terms, parsed.words.join(' '), type);
  writeUrl();
}

function render(ids: string[], terms: string[], query: string, type: string) {
  const visible = ids.slice(0, shown);
  for (const li of cards.values()) li.hidden = true;
  for (const id of visible) {
    const li = cards.get(id)!;
    li.hidden = false;
    list.append(li);
    for (const el of li.querySelectorAll<HTMLElement>('[data-hl]')) highlight(el, terms);
  }
  more.hidden = ids.length <= shown;

  const [one, many] = TYPE_NAMES[type] ?? ['result', 'results'];
  const filtered = Boolean(type || pluginSelect.value || categorySelect?.value);
  count.replaceChildren();
  if (query) {
    count.append(`${ids.length} ${ids.length === 1 ? one : many} ${ids.length === 1 ? 'matches' : 'match'} `);
    const code = document.createElement('code');
    code.textContent = query;
    count.append(code);
  } else {
    count.append(`${ids.length} ${ids.length === 1 ? one : many}${filtered ? '' : ' in the catalog'}`);
  }

  const raw = input.value.trim();
  const isEmpty = ids.length === 0;
  count.hidden = isEmpty;
  empty.hidden = !isEmpty;
  browse.hidden = !isEmpty;
  notIt.hidden = isEmpty || !raw;
  $('empty-q')!.textContent = query || raw;
  $<HTMLButtonElement>('clear')!.hidden = !filtered;
  const href = requestHref(raw);
  $<HTMLAnchorElement>('request')!.href = href;
  $<HTMLAnchorElement>('request-inline')!.href = href;
}

function requestHref(query: string) {
  const u = new URL(config.requestBase);
  u.searchParams.set('title', `Skill request: ${query}`.trim());
  u.searchParams.set('query', query);
  return u.toString();
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function highlight(el: HTMLElement, terms: string[]) {
  const text = el.dataset.text ?? '';
  const words = terms.filter((t) => t.length > 1).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (words.length === 0) {
    el.textContent = text;
    return;
  }
  const re = new RegExp(`(${words.sort((a, b) => b.length - a.length).join('|')})`, 'gi');
  el.innerHTML = escapeHtml(text).replace(re, '<mark>$1</mark>');
}

let timer: number | undefined;
const schedule = () => {
  shown = PAGE_SIZE;
  clearTimeout(timer);
  timer = window.setTimeout(run, 100);
};

input.addEventListener('input', schedule);
input.addEventListener('focus', () => void loadIndex(), { once: true });
typeSelect.addEventListener('change', () => {
  manualType = typeSelect.value;
  if (!manualType) hintDismissed = parseQuery(input.value).typeWord ?? '';
  schedule();
});
pluginSelect.addEventListener('change', schedule);
categorySelect?.addEventListener('change', schedule);
chip.addEventListener('click', () => {
  if (manualType) manualType = '';
  else hintDismissed = parseQuery(input.value).typeWord ?? '';
  run();
  input.focus();
});
$('clear')!.addEventListener('click', () => {
  manualType = '';
  hintDismissed = parseQuery(input.value).typeWord ?? '';
  pluginSelect.value = '';
  if (categorySelect) categorySelect.value = '';
  run();
});
more.addEventListener('click', () => {
  shown += PAGE_SIZE;
  run();
});

// "/" focuses the search box; arrow keys move between result titles.
document.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement;
  const typing = target.closest('input, textarea, select, [contenteditable]');
  if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    input.focus();
    return;
  }
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const links = [...list.querySelectorAll<HTMLAnchorElement>(':scope > li:not([hidden]) a.name')];
  if (links.length === 0) return;
  const i = links.indexOf(target as HTMLAnchorElement);
  if (target === input && e.key === 'ArrowDown') {
    e.preventDefault();
    links[0].focus();
  } else if (i >= 0) {
    e.preventDefault();
    if (e.key === 'ArrowDown') links[Math.min(i + 1, links.length - 1)].focus();
    else if (i === 0) input.focus();
    else links[i - 1].focus();
  }
});

readUrl();
if (location.search) run();
else render(initialOrder, [], '', '');
if (matchMedia('(min-width: 561px)').matches && !location.hash) input.focus();
