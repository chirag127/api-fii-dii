# Oriz Flow — FII/DII Activity API

![Oriz Flow](logo.svg)

Cloudflare Workers API serving daily **FII** (Foreign Institutional Investors) and **DII** (Domestic Institutional Investors) net buy/sell activity for Indian equity markets.

**Production:** `https://flow-fii-dii.api.oriz.in`

## What it does

Pulls daily FII/DII net values (in INR crores) from NSE India, with Moneycontrol HTML scraping as a fallback. Responses are cached in Workers KV for 24h, keyed by date.

## Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/` | Service metadata + endpoint list |
| GET | `/daily` | All cached rows |
| GET | `/daily?from=YYYY-MM-DD&to=YYYY-MM-DD` | Date-range filter |
| GET | `/latest` | Most recent single day |
| GET | `/trend?days=N` | Sum + slice over last N days (1–365, default 30) |

## Example response (`/latest`)

```json
{
  "upstream": "nse",
  "data": {
    "date": "20-Jun-2026",
    "fii_net_crores": -1240.55,
    "dii_net_crores": 1893.12
  }
}
```

CORS: `*`. Errors return `{"error":"upstream failed","message":"..."}` with HTTP 502.

## Develop & deploy

```bash
pnpm install
pnpm dev           # local Worker on :8787
pnpm typecheck
pnpm test
pnpm deploy        # wrangler deploy → flow-fii-dii.api.oriz.in
```

Domain + KV binding live in [`wrangler.toml`](./wrangler.toml). After first deploy, fill in the KV namespace `id`. CI runs Linux-only (see `.github/workflows/`).

## License

MIT — see [LICENSE](./LICENSE).
