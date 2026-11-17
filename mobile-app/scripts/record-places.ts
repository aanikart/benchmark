/**
 * Re-record the bundled OpenStreetMap download used as the offline fallback.
 *   npm run record:places
 * Saves the raw Overpass response with contributor identity fields removed.
 */
import fs from "node:fs";
import path from "node:path";
import { checkOverpassTransport, normalizeOverpass } from "../shared/normalizeOverpass.ts";
import { OVERPASS_URL, OVERPASS_USER_AGENT } from "../shared/overpassClient.ts";
import { QUERY_VERSION, STANFORD, overpassQuery } from "../shared/region.ts";

const out = path.join(import.meta.dirname, "..", "data/recorded/overpass-stanford.json");

for (const waitS of [0, 5, 15, 30, 60]) {
  if (waitS) await new Promise((r) => setTimeout(r, waitS * 1000));
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": OVERPASS_USER_AGENT },
    body: `data=${encodeURIComponent(overpassQuery(STANFORD))}`,
  });
  const text = await res.text();
  try {
    checkOverpassTransport(res.status, res.headers.get("content-type"), text.length);
  } catch (e) {
    console.log(`attempt failed (${(e as { code?: string }).code}); retrying`);
    continue;
  }
  const json = JSON.parse(text);
  for (const e of json.elements) {
    delete e.user;
    delete e.uid;
    delete e.changeset;
  }
  // Validates (throws on a partial/remark response) before anything is written.
  const c = normalizeOverpass(json, { regionId: STANFORD.id, queryVersion: QUERY_VERSION, fetchedAt: new Date().toISOString(), origin: "recorded", now: new Date() });
  fs.writeFileSync(out, JSON.stringify({
    provenance: {
      kind: "recorded-live-response",
      source: OVERPASS_URL,
      recordedAt: new Date().toISOString(),
      osmBase: json.osm3s?.timestamp_osm_base ?? null,
      regionId: STANFORD.id,
      queryVersion: QUERY_VERSION,
      note: "Real Overpass response for shared/region.ts overpassQuery. Contributor identity fields (user, uid, changeset) removed. Not edited otherwise.",
    },
    response: json,
  }));
  console.log(`recorded ${c.places.length} places, ${c.areas.length} outlines, ${fs.statSync(out).size} bytes`);
  process.exit(0);
}
console.error("Overpass unavailable; recording unchanged.");
process.exit(1);
