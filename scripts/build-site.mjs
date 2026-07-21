// Build a minimal, dependency-free static site into dist/ for GitHub Pages.
// Copies data/ and openapi.yaml verbatim and generates an index.html landing
// page (endpoints table + the README chart's data as an inline SVG sparkline).
// No external template, no build tooling. Run: node scripts/build-site.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const dist = join(root, 'dist');
const distData = join(dist, 'data');

mkdirSync(distData, { recursive: true });

// 1. Copy all data files + openapi.yaml verbatim.
for (const f of readdirSync(dataDir)) copyFileSync(join(dataDir, f), join(distData, f));
copyFileSync(join(root, 'openapi.yaml'), join(dist, 'openapi.yaml'));

// 2. Load the dated series for the chart.
const days = readdirSync(dataDir)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort()
  .slice(-30)
  .map((f) => JSON.parse(readFileSync(join(dataDir, f), 'utf8')));

const latest = JSON.parse(readFileSync(join(dataDir, 'latest.json'), 'utf8'));

// 3. Build a small inline SVG line chart of FII vs DII net (no JS, no deps).
function svgChart(series) {
  if (series.length === 0) return '<p>No data yet.</p>';
  const W = 720, H = 260, pad = 36;
  const fii = series.map((d) => d.equity.fii_net);
  const dii = series.map((d) => d.equity.dii_net);
  const all = [...fii, ...dii, 0];
  const min = Math.min(...all), max = Math.max(...all);
  const span = max - min || 1;
  const x = (i) => pad + (i * (W - 2 * pad)) / Math.max(series.length - 1, 1);
  const y = (v) => H - pad - ((v - min) / span) * (H - 2 * pad);
  const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const zeroY = y(0).toFixed(1);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="FII vs DII net equity flow" style="max-width:100%;height:auto">
  <line x1="${pad}" y1="${zeroY}" x2="${W - pad}" y2="${zeroY}" stroke="#cbd5e1" stroke-dasharray="4 4"/>
  <path d="${path(fii)}" fill="none" stroke="#2563eb" stroke-width="2"/>
  <path d="${path(dii)}" fill="none" stroke="#f59e0b" stroke-width="2"/>
  <text x="${pad}" y="18" font-size="13" fill="#2563eb">FII net</text>
  <text x="${pad + 70}" y="18" font-size="13" fill="#f59e0b">DII net</text>
</svg>`;
}

const rows = [
  ['GitHub Pages (canonical)', 'https://chirag127.github.io/fii-dii-activity-api/data/latest.json'],
  ['raw.githubusercontent.com', 'https://raw.githubusercontent.com/chirag127/fii-dii-activity-api/main/data/latest.json'],
  ['jsDelivr CDN', 'https://cdn.jsdelivr.net/gh/chirag127/fii-dii-activity-api@main/data/latest.json'],
  ['Statically CDN', 'https://cdn.statically.io/gh/chirag127/fii-dii-activity-api/main/data/latest.json'],
]
  .map(([name, url]) => `<tr><td>${name}</td><td><a href="${url}"><code>${url}</code></a></td></tr>`)
  .join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FII/DII Activity API</title>
<meta name="description" content="Daily FII/DII net buy/sell activity for Indian equity markets, served as static JSON.">
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 820px; margin: 2rem auto; padding: 0 1rem; line-height: 1.55; }
  h1 { margin-bottom: .2rem; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid #e2e8f0; font-size: .92rem; }
  code { background: rgba(127,127,127,.15); padding: .1rem .3rem; border-radius: 4px; }
  .meta { color: #64748b; font-size: .9rem; }
</style>
</head>
<body>
<h1>FII/DII Activity API</h1>
<p class="meta">Daily FII (Foreign Institutional Investors) and DII (Domestic Institutional Investors) net buy/sell activity for Indian equity markets. Static JSON, no auth, all values in INR crore.</p>

<h2>FII vs DII net equity flow</h2>
${svgChart(days)}
<p class="meta">Latest: <strong>${latest.date}</strong> — FII net ${latest.equity.fii_net} cr, DII net ${latest.equity.dii_net} cr (source: ${latest.source}).</p>

<h2>Endpoints</h2>
<table>
<thead><tr><th>Source</th><th>Latest scrape URL</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
<p class="meta">Specific day: replace <code>latest.json</code> with <code>&lt;YYYY-MM-DD&gt;.json</code>. Machine-readable contract: <a href="./openapi.yaml"><code>openapi.yaml</code></a>.</p>

<h2>Response shape</h2>
<pre><code>{
  "date": "YYYY-MM-DD",
  "source": "nse | moneycontrol | placeholder",
  "equity":     { "fii_buy", "fii_sell", "fii_net", "dii_buy", "dii_sell", "dii_net" },
  "derivative": { ... same fields (currently always zero — NSE fiidii is cash-only) }
}</code></pre>

<p class="meta"><a href="https://github.com/chirag127/fii-dii-activity-api">Source on GitHub</a> · MIT</p>
</body>
</html>
`;

writeFileSync(join(dist, 'index.html'), html);
// SPA-style 404 so unknown paths still return the landing page (optional).
writeFileSync(join(dist, '404.html'), html);
console.log(`Built dist/ (index.html + ${readdirSync(distData).length} data files + openapi.yaml)`);
