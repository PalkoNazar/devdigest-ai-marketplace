// Skill, agent and README bodies are contributor content: render them with no raw HTML.
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export function renderMarkdown(markdown: string, linkBase: string): string {
  const html = marked.parse(markdown, { async: false, gfm: true });
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'del', 'input']),
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title'],
      code: ['class'],
      input: ['type', 'checked', 'disabled'],
      th: ['align'],
      td: ['align'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (tag, attribs) => ({ tagName: tag, attribs: { ...attribs, href: resolve(attribs.href, linkBase) } }),
      img: (tag, attribs) => ({ tagName: tag, attribs: { ...attribs, src: resolve(attribs.src, linkBase) } }),
      input: (tag, attribs) => ({ tagName: tag, attribs: attribs.type === 'checkbox' ? { ...attribs, disabled: '' } : {} }),
    },
  });
}

function resolve(href: string | undefined, base: string): string {
  if (!href) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#') || !base) return href;
  return new URL(href, base).toString();
}
