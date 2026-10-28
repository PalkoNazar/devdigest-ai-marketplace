// Setup page: selected plugins → settings JSON, kept in the URL (?p=a,b&target=managed).
import { copyText } from './common.ts';
import { requiredBy, settingsFor, type SetupPlugin, type Target } from '../lib/setup.ts';

const root = document.getElementById('setup')!;
const config = JSON.parse(root.dataset.config!) as { marketplace: string; repo: string; plugins: SetupPlugin[] };
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const rows = [...document.querySelectorAll<HTMLLIElement>('#plugins > li')];
const boxes = new Map(rows.map((li) => [li.dataset.name!, li.querySelector<HTMLInputElement>('input')!]));
const autoUpdate = $<HTMLInputElement>('auto-update');
const status = $('status');

const params = new URLSearchParams(location.search);
let selected = (params.get('p') ?? '').split(',').filter((n) => boxes.has(n));
let target: Target = params.get('target') === 'managed' ? 'managed' : 'project';
if (params.get('autoUpdate') === '0') autoUpdate.checked = false;
document.querySelector<HTMLInputElement>(`input[name=target][value=${target}]`)!.checked = true;

let current = { json: '', fileLabel: '' };

function render() {
  const needs = requiredBy(config.plugins, selected, config.marketplace);
  for (const li of rows) {
    const name = li.dataset.name!;
    const box = boxes.get(name)!;
    const by = needs.get(name);
    box.checked = selected.includes(name) || Boolean(by);
    box.disabled = Boolean(by);
    const req = li.querySelector<HTMLElement>('.preq')!;
    req.hidden = !by;
    req.textContent = by ? `Required by ${by.join(', ')}` : '';
  }
  $('managed-opts').hidden = target !== 'managed';
  const out = settingsFor({ ...config, selected, target, autoUpdate: autoUpdate.checked });
  current = out;
  $('json').textContent = out.json;
  $('cli').textContent = out.cli;
  $('file-label').textContent = out.fileLabel;

  const p = new URLSearchParams();
  if (selected.length) p.set('p', selected.join(','));
  if (target === 'managed') p.set('target', 'managed');
  if (target === 'managed' && !autoUpdate.checked) p.set('autoUpdate', '0');
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  $('share').textContent = location.href;
}

for (const [name, box] of boxes) {
  box.addEventListener('change', () => {
    selected = box.checked ? [...selected, name] : selected.filter((n) => n !== name);
    status.textContent = '';
    render();
  });
}
for (const radio of document.querySelectorAll<HTMLInputElement>('input[name=target]')) {
  radio.addEventListener('change', () => {
    target = radio.value as Target;
    status.textContent = '';
    render();
  });
}
autoUpdate.addEventListener('change', render);
$<HTMLInputElement>('filter').addEventListener('input', (e) => {
  const f = (e.target as HTMLInputElement).value.toLowerCase().trim();
  for (const li of rows) li.hidden = Boolean(f) && !li.dataset.text!.includes(f);
});
$('copy').addEventListener('click', async () => {
  status.textContent = (await copyText(current.json)) ? 'Copied to clipboard.' : 'Couldn’t copy — select the text instead.';
});
$('download').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([current.json + '\n'], { type: 'application/json' }));
  a.download = current.fileLabel.split('/').pop()!;
  a.click();
  URL.revokeObjectURL(a.href);
});

render();
