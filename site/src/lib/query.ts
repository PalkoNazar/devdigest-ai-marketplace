// Turns a request in plain words into search terms and a type hint.
// "I need a skill for reviewing PRs" → { type: "skill", terms: ["reviewing", "pull", "request"] }
import synonyms from '../search/synonyms.json';

export type QueryType = 'plugin' | 'skill' | 'agent' | 'command' | 'hook' | 'mcp' | 'monitor';

const TYPE_WORDS: Record<string, QueryType> = {
  skill: 'skill',
  skills: 'skill',
  agent: 'agent',
  agents: 'agent',
  subagent: 'agent',
  subagents: 'agent',
  command: 'command',
  commands: 'command',
  hook: 'hook',
  hooks: 'hook',
  mcp: 'mcp',
  server: 'mcp',
  servers: 'mcp',
  monitor: 'monitor',
  monitors: 'monitor',
  plugin: 'plugin',
  plugins: 'plugin',
};

export const STOP_WORDS = new Set(
  (
    'i me my we our you need needs want wants looking look find show get give something anything ' +
    'that which can could would should please help a an the for to with of in on and or is are be ' +
    'do does how some any there'
  ).split(' '),
);

const SYNONYMS: Record<string, string[]> = synonyms;

export type ParsedQuery = { terms: string[]; words: string[]; type?: QueryType; typeWord?: string };

export function parseQuery(input: string): ParsedQuery {
  const words = input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_.-]+/gu, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[.-]+|[.-]+$/g, ''))
    .filter(Boolean);
  let type: QueryType | undefined;
  let typeWord: string | undefined;
  const kept: string[] = [];
  for (const w of words) {
    if (!type && TYPE_WORDS[w]) {
      type = TYPE_WORDS[w];
      typeWord = w;
      continue;
    }
    if (TYPE_WORDS[w] || STOP_WORDS.has(w)) continue;
    kept.push(w);
  }
  const terms: string[] = [];
  for (const w of kept) {
    for (const t of [w, ...(SYNONYMS[w] ?? []).flatMap((s) => s.split(' '))]) {
      if (!terms.includes(t)) terms.push(t);
    }
  }
  return { terms, words: kept, type, typeWord };
}
