import { describe, expect, it } from 'vitest';
import { parseQuery } from '../src/lib/query.ts';

describe('parseQuery', () => {
  it('turns a type word into a hint and drops request phrasing', () => {
    expect(parseQuery('I need a skill for reviewing pull requests')).toEqual({
      type: 'skill',
      typeWord: 'skill',
      terms: ['reviewing', 'review', 'pull', 'requests'],
      words: ['reviewing', 'pull', 'requests'],
    });
  });

  it('expands synonyms', () => {
    expect(parseQuery('agent for PRs').terms).toEqual(['prs', 'pull', 'request']);
  });

  it('returns no terms when only phrasing and a type are left', () => {
    expect(parseQuery('show me some skills')).toEqual({ type: 'skill', typeWord: 'skills', terms: [], words: [] });
  });

  it('keeps kebab-case names and strips punctuation', () => {
    expect(parseQuery('"review-pr"?').terms).toEqual(['review-pr']);
  });
});
