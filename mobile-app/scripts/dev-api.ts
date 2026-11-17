/**
 * Local development route service. Runs the same shared handler as the Supabase Edge Function
 * so the phone can fetch real places and real walking routes before the function is deployed.
 * The ORS key stays on this computer (read from .env); it is never sent to the app.
 *
 *   npm run dev:api
 *
 * Not for deployment: budgets and caches here are in-memory and there is no authentication.
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import type { Catalog } from "../shared/contracts.ts";
import { OutingError } from "../shared/contracts.ts";
import { MAX_REQUEST_BYTES, handleOutingRequest } from "../shared/handler.ts";
import { normalizeOverpass } from "../shared/normalizeOverpass.ts";
import { makeOrsRoute } from "../shared/orsClient.ts";
import { CATALOG_TTL_MS, fetchCatalog } from "../shared/overpassClient.ts";
import { QUERY_VERSION } from "../shared/region.ts";

const require = createRequire(import.meta.url);
const root = path.join(import.meta.dirname, "..");
const env = require("./loadEnv.cjs")() as Record<string, string>;
const PORT = Number(process.env.PORT ?? 8787);

if (!env.ORS_API_KEY) {
  console.error("ORS_API_KEY is missing from mobile-app/.env");
  process.exit(1);
}

// ---- catalog: live Overpass with a 24 h cache; the recorded download is the fallback ----
function recordedCatalog(): Catalog {
  const rec = JSON.parse(fs.readFileSync(path.join(root, "data/recorded/overpass-stanford.json"), "utf8"));
  return normalizeOverpass(rec.response, {
    regionId: rec.provenance.regionId,
    queryVersion: QUERY_VERSION,
    fetchedAt: rec.provenance.recordedAt,
    origin: "recorded",
    now: new Date(),
  });
}

// Requests never wait on Overpass: they get the newest catalog already held, and a stale
// one is refreshed in the background (at most one attempt per minute, one at a time).
let cached: Catalog = recordedCatalog();
let refreshing = false;
let lastAttempt = 0;

async function getCatalog(regionId: string): Promise<Catalog> {
  const fresh = cached.origin === "live" && Date.now() - Date.parse(cached.fetchedAt) < CATALOG_TTL_MS;
  if (!fresh && !refreshing && Date.now() - lastAttempt > 60_000) {
    refreshing = true;
    lastAttempt = Date.now();
    fetchCatalog(regionId, fetch)
      .then((c) => {
        cached = c;
        log({ event: "catalog_refresh", status: "ok", places: c.places.length });
      })
      // A failed refresh never replaces the last good result or resets its fetch time.
      .catch((e) => log({ event: "catalog_refresh", status: "failed", category: e?.code ?? "network" }))
      .finally(() => {
        refreshing = false;
      });
  }
  return cached;
}

// ---- budgets (in-memory; the deployed function enforces these in Postgres) ----
const WINDOW_MS = 5 * 60 * 1000;
const MAX_COMPARISONS = 10;
const comparisons: number[] = [];
let inFlight = false;
let providerCalls = 0;

const route = makeOrsRoute({
  apiKey: env.ORS_API_KEY,
  fetch,
  onCall: () => {
    providerCalls += 1;
  },
});

// Operational log only: no request bodies, coordinates or notes.
function log(entry: Record<string, unknown>) {
  console.log(JSON.stringify({ t: new Date().toISOString(), ...entry }));
}

function send(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/outing-api") {
    return send(res, 404, { ok: false, error: { code: "INVALID_REQUEST", message: "Not found" } });
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_REQUEST_BYTES) {
      return send(res, 413, { ok: false, error: { code: "INVALID_REQUEST", message: "Request too large" } });
    }
    chunks.push(chunk as Buffer);
  }
  let body: { action?: string; requestId?: string } | null = null;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return send(res, 400, { ok: false, error: { code: "INVALID_REQUEST", message: "Invalid JSON" } });
  }

  const started = Date.now();
  const callsBefore = providerCalls;
  const isCompare = body?.action === "compare";
  if (isCompare) {
    const cutoff = Date.now() - WINDOW_MS;
    while (comparisons.length && comparisons[0] < cutoff) comparisons.shift();
    if (inFlight || comparisons.length >= MAX_COMPARISONS) {
      const retryAfterSeconds = inFlight ? 5 : Math.ceil((comparisons[0] + WINDOW_MS - Date.now()) / 1000);
      const e = new OutingError("RATE_LIMITED", "Too many comparisons. Please wait before trying again.", retryAfterSeconds);
      log({ event: "request", action: body?.action, requestId: body?.requestId, status: "rate_limited" });
      return send(
        res,
        429,
        { ok: false, error: { code: e.code, message: e.message, retryAfterSeconds } },
        { "Retry-After": String(retryAfterSeconds) },
      );
    }
    comparisons.push(Date.now());
    inFlight = true;
  }
  try {
    const out = await handleOutingRequest(body, { getCatalog, route });
    log({
      event: "request",
      action: body?.action,
      requestId: body?.requestId,
      status: out.ok ? "ok" : out.error.code,
      ms: Date.now() - started,
      providerCalls: providerCalls - callsBefore,
    });
    send(res, out.ok ? 200 : out.error.code === "RATE_LIMITED" ? 429 : 422, out);
  } finally {
    if (isCompare) inFlight = false;
  }
});

server.listen(PORT, "0.0.0.0", () => {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i!.address);
  console.log(`Benchmark dev route service on port ${PORT} (LAN: ${ips.join(", ") || "none"})`);
});
