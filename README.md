# Oriz Flow — FII/DII Activity API

![Oriz Flow](logo.svg)

Daily **FII** (Foreign Institutional Investors) and **DII** (Domestic Institutional Investors) net buy/sell activity for Indian equity markets — scraped by GitHub Actions, served as static JSON via GitHub Pages and `raw.githubusercontent.com`. Zero Cloudflare Workers, zero ongoing cost.

## Chart

<!-- CHART:BEGIN -->
**FII vs DII net equity flow (₹ crore, most recent sessions)**

```mermaid
xychart-beta
    title "FII net (line 1) vs DII net (line 2) — INR crore"
    x-axis ["06-22", "06-23", "06-24", "07-02", "07-03", "07-06", "07-07", "07-08", "07-09", "07-10", "07-13", "07-14", "07-15", "07-16", "07-17", "07-20", "07-21"]
    y-axis "Net (INR cr)" -1 --> 1
    line [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    line [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
```

<sub>FII = first line, DII = second line. Auto-generated from `data/` by `scripts/chart.mjs` on each scrape. Last 17 session(s).</sub>
<!-- CHART:END -->

## Endpoints (static JSON)

| URL | Description |
| --- | --- |
| `https://chirag127.github.io/fii-dii-activity-api/latest.json` | Most recent scrape |
| `https://chirag127.github.io/fii-dii-activity-api/<YYYY-MM-DD>.json` | A specific day |
| `https://raw.githubusercontent.com/chirag127/fii-dii-activity-api/main/data/latest.json` | Same data via raw (no Pages dependency) |

## Response shape (`latest.json`)

```json
{
  "date": "2026-06-22",
  "source": "nse",
  "equity":     { "fii_buy": 0, "fii_sell": 0, "fii_net": 0, "dii_buy": 0, "dii_sell": 0, "dii_net": 0 },
  "derivative": { "fii_buy": 0, "fii_sell": 0, "fii_net": 0, "dii_buy": 0, "dii_sell": 0, "dii_net": 0 }
}
```

`source` is one of `nse` (primary), `moneycontrol` (fallback), or `placeholder` (both failed). All values are INR crores.

## Schedule

Weekdays 13:00 UTC (~18:30 IST, after NSE close). Manually re-runnable via the **scrape** workflow.

## Local run

```bash
npm install
node scripts/scrape.mjs   # writes data/<today>.json + data/latest.json
```

## License

MIT — see [LICENSE](./LICENSE).
