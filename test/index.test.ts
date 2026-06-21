import { describe, it, expect } from "vitest";
import app from "../src/index";

const env = { CACHE: { get: async () => null, put: async () => {} } as unknown as KVNamespace };

describe("router", () => {
  it("GET / returns metadata", async () => {
    const res = await app.request("/", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.name).toBe("oriz-flow-fii-dii-activity-api");
    expect(Array.isArray(body.endpoints)).toBe(true);
  });

  it("GET /daily wires through", async () => {
    const res = await app.request("/daily", {}, env);
    expect([200, 502]).toContain(res.status);
  });

  it("GET /latest wires through", async () => {
    const res = await app.request("/latest", {}, env);
    expect([200, 502]).toContain(res.status);
  });

  it("GET /trend?days=7 wires through", async () => {
    const res = await app.request("/trend?days=7", {}, env);
    expect([200, 502]).toContain(res.status);
  });
});
