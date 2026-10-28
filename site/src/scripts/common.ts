// Theme toggle and copy buttons, on every page.
const root = document.documentElement;
const toggle = document.querySelector<HTMLButtonElement>('.theme-toggle');

function syncToggle() {
  const dark = root.dataset.theme === 'dark';
  toggle?.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
}
syncToggle();
toggle?.addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem('theme', root.dataset.theme);
  } catch {}
  syncToggle();
});

const live = document.createElement('div');
live.className = 'visually-hidden';
live.setAttribute('aria-live', 'polite');
document.body.append(live);

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

document.addEventListener('click', async (e) => {
  const button = (e.target as Element).closest<HTMLButtonElement>('[data-copy]');
  if (!button) return;
  const ok = await copyText(button.dataset.copy!);
  live.textContent = ok ? 'Copied to clipboard.' : 'Couldn’t copy. Select the text instead.';
  if (ok) {
    button.dataset.copied = '';
    setTimeout(() => delete button.dataset.copied, 1500);
  }
});
