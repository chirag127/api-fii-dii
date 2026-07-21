// One-off backfill of historical FII/DII cash-segment data. The pre-fix scraper
// committed all-zero files for these dates; this repopulates them with real
// provisional figures cross-verified across Groww, Kotak Neo, Sensibull,
// Multibagg and Sahifund (all agree on the CM cash buy/sell/net, INR crore).
// Derivative stays zero (out of scope — NSE fiidii is cash-only).
// Run once: node scripts/backfill.mjs
import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildPayload, makeBlock, validatePayload, zeroBlock } from './lib/schema.mjs';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

// [date, fiiBuy, fiiSell, fiiNet, diiBuy, diiSell, diiNet]
const ROWS = [
  ['2026-06-22', 10082.08, 10717.99, -635.91, 17391.78, 16356.06, 1035.72],
  ['2026-06-23', 15396.07, 15378.21, 17.86, 16863.04, 16182.83, 680.21],
  ['2026-06-24', 16744.73, 18588.13, -1843.40, 17274.01, 13636.75, 3637.26],
  ['2026-07-02', 14018.40, 14330.22, -311.82, 17391.61, 15607.21, 1784.40],
  ['2026-07-03', 13337.33, 11982.00, 1355.33, 18676.35, 20630.24, -1953.89],
  ['2026-07-06', 11686.10, 11443.07, 243.03, 19727.56, 15936.14, 3791.42],
  ['2026-07-07', 18414.01, 18020.82, 393.19, 18897.44, 19280.87, -383.43],
  ['2026-07-08', 17463.95, 15501.15, 1962.80, 19165.13, 18374.97, 790.16],
  ['2026-07-09', 14388.41, 14921.27, -532.86, 18302.87, 16245.08, 2057.79],
  ['2026-07-10', 15318.07, 12714.35, 2603.72, 17171.75, 15152.07, 2019.68],
  ['2026-07-13', 10386.48, 13448.75, -3062.27, 17393.46, 15221.76, 2171.70],
  ['2026-07-14', 12763.43, 13503.12, -739.69, 20420.87, 17493.16, 2927.71],
  ['2026-07-15', 13207.46, 13943.29, -735.83, 16226.42, 15521.49, 704.93],
  ['2026-07-16', 13576.08, 17781.64, -4205.56, 19236.80, 16250.39, 2986.41],
  ['2026-07-17', 14393.77, 14770.18, -376.41, 17180.08, 16162.19, 1017.89],
  ['2026-07-20', 13312.67, 14433.71, -1121.04, 16187.84, 14875.81, 1312.03],
  ['2026-07-21', 16327.88, 14677.72, 1650.16, 14638.54, 15295.42, -656.88],
];

let latest = null;
for (const [date, fb, fs, fn, db, ds, dn] of ROWS) {
  const payload = buildPayload({
    date,
    source: 'moneycontrol',
    equity: makeBlock({ fii: { buy: fb, sell: fs, net: fn }, dii: { buy: db, sell: ds, net: dn } }),
    derivative: zeroBlock(),
  });
  const { ok, errors } = validatePayload(payload);
  if (!ok) {
    console.error(`REFUSING to write ${date}: ${errors.join('; ')}`);
    process.exitCode = 1;
    continue;
  }
  const file = join(dataDir, `${date}.json`);
  if (!existsSync(file)) console.warn(`note: ${date}.json did not exist, creating`);
  writeFileSync(file, JSON.stringify(payload, null, 2) + '\n');
  latest = payload;
}

if (latest) {
  writeFileSync(join(dataDir, 'latest.json'), JSON.stringify(latest, null, 2) + '\n');
  console.log(`Backfilled ${ROWS.length} files; latest.json -> ${latest.date}`);
}
