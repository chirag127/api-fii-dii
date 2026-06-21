import { Hono } from "hono";
import { cors } from "hono/cors";

type Env = { CACHE: KVNamespace };
type Row = { date: string; fii_net_crores: number; dii_net_crores: number };

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TTL = 60 * 60 * 24;

async function fetchNse(): Promise<Row[]> {
  const r = await fetch("https://www.nseindia.com/api/fiidiiTradeReact", {
    headers: { "User-Agent": UA, "Accept": "application/json", "Referer": "https://www.nseindia.com/" },
  });
  if (!r.ok) throw new Error(`nse ${r.status}`);
  const data = await r.json() as any[];
  const byDate: Record<string, Row> = {};
  for (const d of data) {
    const date = String(d.date);
    if (!byDate[date]) byDate[date] = { date, fii_net_crores: 0, dii_net_crores: 0 };
    const net = Number(d.netValue ?? 0);
    if (String(d.category).toUpperCase().startsWith("FII") || String(d.category).toUpperCase().startsWith("FPI")) byDate[date].fii_net_crores = net;
    else if (String(d.category).toUpperCase().startsWith("DII")) byDate[date].dii_net_crores = net;
  }
  return Object.values(byDate);
}

async function fetchMc(): Promise<Row[]> {
  const r = await fetch("https://www.moneycontrol.com/stocks/marketstats/fii_dii_activity/index.php", { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`mc ${r.status}`);
  const html = await r.text();
  const rows: Row[] = [];
  const rx = /<tr[^>]*>\s*<td[^>]*>(\d{2}-[A-Za-z]{3}-\d{4})<\/td>[\s\S]*?<td[^>]*>([\-\d,.]+)<\/td>[\s\S]*?<td[^>]*>([\-\d,.]+)<\/td>/g;
  let m;
  while ((m = rx.exec(html)) !== null) {
    rows.push({ date: m[1], fii_net_crores: parseFloat(m[2].replace(/,/g, "")), dii_net_crores: parseFloat(m[3].replace(/,/g, "")) });
  }
  if (!rows.length) throw new Error("mc parse empty");
  return rows;
}

async function getData(env: Env): Promise<{ rows: Row[]; upstream: string }> {
  const key = "data:" + new Date().toISOString().slice(0, 10);
  const cached = await env.CACHE.get(key, "json") as { rows: Row[]; upstream: string } | null;
  if (cached) return cached;
  let rows: Row[] = [];
  let upstream = "nse";
  try { rows = await fetchNse(); } catch { upstream = "mc"; rows = await fetchMc(); }
  const out = { rows, upstream };
  await env.CACHE.put(key, JSON.stringify(out), { expirationTtl: TTL });
  return out;
}

const app = new Hono<{ Bindings: Env }>();
app.use("*", cors({ origin: "*" }));

app.get("/", (c) => c.json({ name: "oriz-flow-fii-dii-activity-api", endpoints: ["/daily", "/daily?from=YYYY-MM-DD&to=YYYY-MM-DD", "/latest", "/trend?days=N"] }));

app.get("/daily", async (c) => {
  try {
    const { rows, upstream } = await getData(c.env);
    const from = c.req.query("from"), to = c.req.query("to");
    const filtered = (from || to) ? rows.filter(r => (!from || r.date >= from) && (!to || r.date <= to)) : rows;
    return c.json({ upstream, count: filtered.length, data: filtered });
  } catch (e: any) { return c.json({ error: "upstream failed", message: e.message }, 502); }
});

app.get("/latest", async (c) => {
  try {
    const { rows, upstream } = await getData(c.env);
    return c.json({ upstream, data: rows[0] ?? null });
  } catch (e: any) { return c.json({ error: "upstream failed", message: e.message }, 502); }
});

app.get("/trend", async (c) => {
  try {
    const days = Math.max(1, Math.min(365, parseInt(c.req.query("days") ?? "30", 10)));
    const { rows, upstream } = await getData(c.env);
    const slice = rows.slice(0, days);
    const fii = slice.reduce((s, r) => s + r.fii_net_crores, 0);
    const dii = slice.reduce((s, r) => s + r.dii_net_crores, 0);
    return c.json({ upstream, days, fii_net_total_crores: fii, dii_net_total_crores: dii, data: slice });
  } catch (e: any) { return c.json({ error: "upstream failed", message: e.message }, 502); }
});

export default app;
