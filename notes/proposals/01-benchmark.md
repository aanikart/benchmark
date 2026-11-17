# Benchmark — Plan a walk around places to rest

[All seven ideas](00-final-project-ideas.md) · [Detailed implementation plan](../project-plans/10-benchmark-api-first-plan.md) · [Build guide](08-project-build-guide.md) · [Name review](09-project-name-review.md)

Benchmark compares a direct walk with a route through mapped seating, showing both the total distance and the longest mapped stretch between planned breaks. It obtains place information from APIs, so neither the team nor the person using the app needs to survey benches or maintain a geographic inventory.

**Revised November 16, 2026.** The [detailed plan](../project-plans/10-benchmark-api-first-plan.md) replaces this proposal’s earlier inspection requirement and effort estimate. It includes the alternative-landmark assessment, screen designs, route algorithm, React Native architecture, Supabase model, construction sequence, and adversarial review. Earlier comparison-guide illustrations describe the previous proposal and should not be treated as the current specification.

## The idea in use

Someone selects a nearby destination and a preferred distance between rests. Benchmark retrieves walking routes and mapped places to sit, then explains the tradeoff: “This route is 90 m farther and includes one mapped seating stop.” The person can inspect the stop’s attributes, see its source dates, and understand which details remain unknown.

The signature interaction is a **rest ribbon**: walking stretches alternate with planned resting places. Changing the distance preference updates the comparison immediately. Selecting “Preview without this stop” joins the adjoining stretches along the same path, making the consequence of an unavailable seat visible. An equivalent ordered list supports people who cannot use the map.

The person includes a return arrangement, saves the outing privately, and reopens it later. Optional post-walk feedback records their experience without becoming a prerequisite for planning. A recent download or map edit never becomes an “inspected” label.

## Benches, other seating, and landmarks

Retain benches as the primary rest source, with a small expansion supported by OpenStreetMap tags:

| Place | Role in the app |
|---|---|
| Bench | Primary mapped seating, subject to the person’s required attributes and routing checks. |
| Picnic table | Additional seating when the person explicitly enables that seating style. |
| Shelter with explicit seating tags | Possible covered rest; a shelter without seating evidence cannot divide a seated-rest stretch. |
| Public art, viewpoints, libraries, and cafés | Appealing destinations and orientation cues; their category alone does not establish usable seating. |

The [landmark assessment](../project-plans/10-benchmark-api-first-plan.md#2-should-another-landmark-replace-the-bench) compares Overpass, Google Places, Geoapify, GTFS, and Wikidata. Broadening the destination catalog improves the outing while preserving the distinction between a landmark and a resting opportunity. If alternative seating is absent locally, the same application works with benches alone.

## Technical direction

Use the existing Expo/TypeScript starter with Expo Router, meaningful nested stacks and tabs, and save/feedback modals. React state drives route selection, preference changes, and the ribbon. A shared pure TypeScript module calculates eligibility and distances for the backend and mobile interface.

- OpenStreetMap through a bounded, cached Overpass query supplies places and provenance.
- openrouteservice supplies actual walking geometry and waypoint-leg distances through a server-held API key.
- Turf supports candidate discovery and geometry checks; proximity alone does not prove pedestrian access.
- React Native Maps and SVG provide the map and ribbon, with equivalent text controls.
- Supabase stores private preferences, saved outings, and optional feedback under owner-specific access rules. Anonymous sessions avoid mandatory account onboarding.

The [API and backend specification](../project-plans/10-benchmark-api-first-plan.md#6-apis-cache-policy-and-operating-limits) includes the current HeiGIT routing host, request bounds, cache rules, and provider constraints. The [architecture section](../project-plans/10-benchmark-api-first-plan.md#7-react-native-architecture-and-one-way-data-flow) maps the design to the actual starter.

## Rules that preserve an honest comparison

Count only explicitly planned seating waypoints whose required attributes are known and whose routing checks pass. Missing required backrest information excludes a stop. Keep access to the actual seat visibly unconfirmed, even when a route passes nearby; all displayed gaps are estimates along mapped paths.

Include the start-to-first-stop and last-stop-to-destination stretches. For a walking return, obtain a separate route and join the stretches across the destination unless a qualifying rest is planned there. Reaching a destination or a bench does not imply that the person rested.

If the bounded search finds no suitable alternative, show that outcome without relaxing the preference or inventing a second route. Saved routes are dated snapshots; refreshing produces a new comparison for review. The app does not certify a route as safe or accessible.

## Scope and effort

The core covers short outings in one automatically loaded campus or neighborhood, a direct route and a useful alternative through up to two seats, an explicit return arrangement, private history, and an accessible outing guide. Weather is the first optional extension. Health integrations, wheelchair-specific planning, public contribution moderation, and background turn-by-turn navigation are deferred until their separate requirements can be supported.

Estimate **68–96 active human person-hours** with coding assistance for the specified core, including device testing and distribution. This is a planning estimate. Begin with the [6–10-hour feasibility phase](../project-plans/10-benchmark-api-first-plan.md#10-construction-sequence-and-acceptance-gates): verify real local data, a routed seat alternative, named endpoint choices, and both native map builds. No field-survey campaign is required.

Provider documentation was checked for the detailed plan, but the live Overpass probe timed out. Local coverage, authenticated routing, and native integration remain implementation acceptance gates. The [verification specification](../project-plans/10-benchmark-api-first-plan.md#11-verification-specification) and [adversarial findings with fixes](../project-plans/10-benchmark-api-first-plan.md#12-adversarial-review-and-fixes) make those limits explicit.

[Read the complete construction plan](../project-plans/10-benchmark-api-first-plan.md)
