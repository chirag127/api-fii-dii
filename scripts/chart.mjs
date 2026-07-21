// Regenerate the FII/DII net-activity chart in README.md from data/*.json.
// Renders a GitHub-native Mermaid xychart-beta (no external service, no key)
// showing FII net vs DII net (₹ crore) over the most recent sessions.
// The chart lives between the CHART markers so it can be regenerated in place.
// Run: node scripts/chart.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const readmePath = join(root, 'README.md');
const MAX_POINTS = 20;

const BEGIN = '<!-- CHART:BEGIN -->';
const END = '<!-- CHART:END -->';

function loadDays() {
  return readdirSync(dataDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .slice(-MAX_POINTS)
    .map((f) => JSON.parse(readFileSync(join(dataDir, f), 'utf8')));
}

function buildChart(days) {
  if (days.length === 0) return `${BEGIN}\n_No data yet._\n${END}`;
  const labels = days.map((d) => `"${d.date.slice(5)}"`); // MM-DD
  const fii = days.map((d) => d.equity.fii_net);
  const dii = days.map((d) => d.equity.dii_net);
  const all = [...fii, ...dii, 0];
  let min = Math.floor(Math.min(...all));
  let max = Math.ceil(Math.max(...all));
  // Mermaid rejects a zero-height axis; pad when all values are equal (e.g.
  // before any non-zero data has been scraped) so the block always renders.
  if (min === max) {
    min -= 1;
    max += 1;
  }
  // xychart-beta renders one series per `line`; GitHub colours them in order.
  return [
    BEGIN,
    '**FII vs DII net equity flow (₹ crore, most recent sessions)**',
    '',
    '```mermaid',
    'xychart-beta',
    `    title "FII net (line 1) vs DII net (line 2) — INR crore"`,
    `    x-axis [${labels.join(', ')}]`,
    `    y-axis "Net (INR cr)" ${min} --> ${max}`,
    `    line [${fii.join(', ')}]`,
    `    line [${dii.join(', ')}]`,
    '```',
    '',
    `<sub>FII = first line, DII = second line. Auto-generated from \`data/\` by \`scripts/chart.mjs\` on each scrape. Last ${days.length} session(s).</sub>`,
    END,
  ].join('\n');
}

const readme = readFileSync(readmePath, 'utf8');
const chart = buildChart(loadDays());

let next;
if (readme.includes(BEGIN) && readme.includes(END)) {
  next = readme.replace(new RegExp(`${BEGIN}[\\s\\S]*?${END}`), chart);
} else {
  // Insert the chart right after the first paragraph following the H1.
  const anchor = '\n## Endpoints';
  const idx = readme.indexOf(anchor);
  next = idx === -1
    ? `${readme}\n\n## Chart\n\n${chart}\n`
    : `${readme.slice(0, idx)}\n## Chart\n\n${chart}\n${readme.slice(idx)}`;
}

if (next !== readme) {
  writeFileSync(readmePath, next);
  console.log('README chart updated.');
} else {
  console.log('README chart already current.');
}
