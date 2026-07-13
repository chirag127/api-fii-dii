# Oriz Flow — FII/DII Activity API

![Oriz Flow](logo.svg)

Daily **FII** (Foreign Institutional Investors) and **DII** (Domestic Institutional Investors) net buy/sell activity for Indian equity markets — scraped by GitHub Actions, served as static JSON via GitHub Pages and `raw.githubusercontent.com`. Zero Cloudflare Workers, zero ongoing cost.

## Endpoints (static JSON)

| URL | Description |
| --- | --- |
| `https://chirag127.github.io/flow-fii-dii-activity/latest.json` | Most recent scrape |
| `https://chirag127.github.io/flow-fii-dii-activity/<YYYY-MM-DD>.json` | A specific day |
| `https://raw.githubusercontent.com/chirag127/flow-fii-dii-activity/main/data/latest.json` | Same data via raw (no Pages dependency) |

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
