// MiniSearch options shared by the build (index) and the browser (query). They must match.
export type SearchDoc = {
  id: string;
  type: string;
  plugin: string;
  category: string;
  name: string;
  displayName: string;
  description: string;
  keywords: string;
  tags: string;
  bodyText: string;
};

export const searchOptions = {
  // category is a filter, not a search field: matching it would return every artifact of a plugin.
  fields: ['name', 'displayName', 'keywords', 'tags', 'description', 'plugin', 'bodyText'],
  storeFields: ['type', 'plugin', 'category'],
  // Split kebab-case names so "review-pr" matches "review".
  tokenize: (text: string) => text.split(/[\s\-_/:.,;!?()"'`]+/u).filter(Boolean),
};

export const searchBoost = {
  name: 4,
  displayName: 4,
  keywords: 3,
  tags: 3,
  description: 2,
  plugin: 1.5,
  bodyText: 0.5,
};
