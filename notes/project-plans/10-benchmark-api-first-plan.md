# Benchmark — A walk with places to pause

[Proposal overview](../proposals/01-benchmark.md) · [Shared build guide](../proposals/08-project-build-guide.md)

**Design and implementation plan · November 16, 2026**

Build an Expo application that compares the distance of a walk with the distance between its mapped resting places. Someone chooses a destination and a preferred distance between breaks, compares a direct route with a route through seating, and saves the complete outing, including the return arrangement. The app obtains place information automatically; using it never depends on surveying benches, contributing reports, connecting a wearable, or entering API keys.

The recommendation is to retain Benchmark and broaden its place model. Benches remain the clearest seating source. Picnic tables and certain shelters can provide additional resting opportunities. Public art, viewpoints, libraries, and cafés give people reasons to take a walk and recognizable destinations. A landmark becomes a rest stop only when its seating evidence also meets the rules below.

This document replaces the earlier requirements for manually inspected routes, a hand-entered bench catalog, and a fixed pair of destinations. It is a construction specification, not a report of a working app. Provider documentation was checked for this revision. A bounded live Overpass request timed out; local coverage is therefore unverified. No authenticated routing request, Supabase migration, or installed mobile build was tested during this planning work.

## 1. Product decision and scope

### The useful promise

The question the interface answers is: **“How much farther would I walk to include a place to sit, and how long are the stretches between those planned stops?”**

Keep both answers visible. A route with shorter stretches can still demand substantially more walking overall. Neither an API route nor an OpenStreetMap entry establishes that a seat is usable today, that a gate is open, or that a person can comfortably complete the journey. The application should expose those assumptions at the point of comparison without making the person interpret a technical data-quality score.

The first release supports short outings in one configured campus or neighborhood. Stanford is the initial discovery area, with a proposed bounding box of south `37.420`, west `-122.180`, north `37.435`, east `-122.160`. This is a search boundary, not a claim of verified accessibility. Load its places from APIs. Store no invented local bench descriptions or fabricated inspection dates.

### What ships

| Capability | Concrete behavior |
|---|---|
| Choose an outing | Select a named starting place and destination from downloaded nearby places; optionally use foreground location or a map pin. |
| Set a rest preference | Choose a maximum preferred stretch, with preset buttons and a numeric input; optionally require a backrest. |
| Compare routes | Show the direct route and, when available, one useful alternative through one or two mapped seats. |
| Explore the rest ribbon | Select a segment or stop; the route explanation, map highlight, and ordered list stay synchronized. |
| Test an assumption | Preview how the longest stretch changes if a selected seat cannot be used. |
| Include the return | Request a separate return route or record a separately arranged return; show an outward-only draft explicitly. |
| Save and reopen | Persist private outings in Supabase, retain a local copy, and show the age of a reopened plan. |
| Reflect optionally | Record whether the outing felt manageable and whether a planned stop matched its description. |

The default distance control can show `300 m` as an editable example, labeled “Choose a distance that suits you.” Do not present it as a recommendation derived from age, diagnosis, or sensor readings. Offer `150`, `250`, `400`, and `600 m` shortcuts, plus a numeric value from `50–1,000 m`. These are interface limits for this prototype, not physiological thresholds.

### Occam’s Razor decisions

Use one place provider, one routing provider, and Supabase. A small deterministic search over candidate seats is enough for a useful comparison; a general route optimizer would add substantial work before establishing the core interaction. Keep one shared route-analysis implementation, ordinary React state, and a small number of screens. Put experimentation into the rest ribbon and the explanation of tradeoffs.

The installed app requires no external setup from its user. The development team still configures the routing key, Supabase project, app identity, and Android map credentials. New live plans require connectivity. Saved text, geometry, and the ribbon remain readable offline; offline basemap downloads are outside this release.

## 2. Should another landmark replace the bench?

There are two separate needs: a recognizable place to walk toward, and a place where a seated break is plausible. APIs offer many objects for the first need, but substantially less reliable information for the second. Replacing every bench with a café, park, or bus stop would increase the apparent number of stops while weakening the rest-distance calculation.

### Candidate comparison

| Object | API-accessible evidence | Useful role | Can split the seated-rest calculation? |
|---|---|---|---|
| Bench | OSM `amenity=bench`; sometimes `backrest`, `armrest`, `material`, and `access`. | Primary seating source. | Yes, conditionally, after the eligibility and routing checks in §5. |
| Picnic table | OSM `leisure=picnic_table` describes a table with seating. | Optional alternative for people comfortable using this seating style. | Yes only when the person enables picnic-table seating and required attributes are known. |
| Shelter or pavilion | OSM `amenity=shelter`; `bench=yes` or `picnic_table=yes` can describe seating. | Covered resting opportunity when seating is explicitly mapped. | Only with seating evidence; a roof alone cannot split a stretch. |
| Bus or tram waiting area | OSM `public_transport=platform` or `highway=bus_stop`, sometimes `bench=yes`. | Recognizable landmark and possible later seating source. | Defer counting in the first release: location, passenger access, and separate-seat duplication require more work. |
| Café | OSM or a commercial Places API provides a venue and potentially hours. | Destination or optional planned purchase. | No automatic credit. Seating, customer access, queues, and hours remain separate questions. |
| Library or community center | OSM or venue APIs describe the building. | Meaningful destination, often recognizable without a map. | No automatic credit for indoor seating or public entry. |
| Public artwork or viewpoint | OSM `tourism=artwork` / `tourism=viewpoint`; some objects link to Wikidata. | A pleasant destination or orientation cue. | No, unless a separately represented eligible seat is planned. |
| Drinking fountain or toilets | OSM `amenity=drinking_water` / `amenity=toilets`. | Optional convenience markers. | No; providing water or a toilet does not establish suitable resting seating. |
| Park or plaza | OSM area geometry and a name. | Destination context. | No; a polygon center is neither a seat nor an entrance. |

The tag semantics support a modest expansion: [benches](https://wiki.openstreetmap.org/wiki/Tag:amenity%3Dbench), [picnic tables](https://wiki.openstreetmap.org/wiki/Tag:leisure%3Dpicnic_table), and [shelters with seating tags](https://wiki.openstreetmap.org/wiki/Tag:amenity%3Dshelter). [Transit platforms](https://wiki.openstreetmap.org/wiki/Tag:public_transport%3Dplatform) can carry bench information, but a vehicle’s stopping point must not be mistaken for the passenger waiting area. [Viewpoints](https://wiki.openstreetmap.org/wiki/Tag:tourism%3Dviewpoint) describe a view, which may be elevated or reached by difficult terrain. These are data definitions, not evidence of local availability.

### API alternatives and the decision

| Source | What it contributes | Why it is or is not in the core |
|---|---|---|
| OpenStreetMap through Overpass | Seating objects, selected nearby landmarks, provenance, and raw attributes in one bounded query. | Selected for the course prototype. Unknown fields remain unknown, and public-server dependence is limited by a shared cache. |
| Google Places API (New) | Venue discovery, business status, hours, and optional accessibility fields such as `wheelchairAccessibleSeating`. | Useful for a later indoor-break feature, but it cannot establish a free seat at arrival. Requires field selection, billing configuration, and a separate storage/display policy. |
| Geoapify Places | Managed category and spatial searches for venues and landmarks. | An alternative discovery adapter if operational requirements justify it. Do not assume its category results improve underlying seating completeness. |
| Agency GTFS feeds | Stop positions, service schedules, and certain boarding-accessibility fields. | Appropriate for a future transit return, not evidence that a bus stop has a bench. |
| Wikidata | Context about notable places and location-based discovery. | Optional enrichment for an interesting destination; unnecessary for the routing decision. |

Google documents [place fields](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places), [field masks and billing implications](https://developers.google.com/maps/documentation/places/web-service/place-details), and [restrictions on storing and displaying Places data](https://developers.google.com/maps/documentation/places/web-service/policies). Its content should not simply be copied into the OSM cache or overlaid on an Apple map. Geoapify documents [category and area queries](https://www.geoapify.com/places-api/). The [GTFS specification](https://gtfs.org/documentation/schedule/reference/) defines `wheelchair_boarding` in terms of boarding and access, not seating. [Wikidata’s query examples](https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service/queries/examples) support location-based discovery.

**Decision:** retain Benchmark, with “Places to sit” as the inclusive UI label. Add picnic tables as an explicit seating preference and shelters with explicit seating evidence. Use landmarks to improve destination choice and orientation. Do not create a second sightseeing product, add another provider merely to increase pin density, or infer seating from a venue category. If alternative seating is absent locally, the same design works with benches alone.

## 3. The experience, screen by screen

### Navigation

Use the starter’s Expo Router with a root stack, three tabs, nested stacks, and focused modals. [Expo Router’s navigation documentation](https://docs.expo.dev/router/advanced/stack/) describes the stack primitives and links to nesting and modal behavior.

```text
Root Stack
├── Tabs
│   ├── Plan Stack
│   │   ├── Plan home
│   │   └── Route comparison
│   ├── Saved Stack
│   │   ├── Saved outings
│   │   └── Saved outing detail
│   └── Preferences Stack
│       ├── Preferences
│       └── Data and privacy
├── Place detail                  shared by Plan and Saved
├── Outing guide                  manual progress through a saved plan
├── Save outing modal             name, return arrangement, optional note
└── Feedback modal                optional post-outing reflection
```

Pass stable IDs through navigation, not serialized route geometries or personal notes. A missing or expired in-memory comparison ID opens a recoverable “Build this plan again” screen. A saved outing ID loads from local storage and then Supabase. Android Back, iOS back gestures, and closing a modal must preserve the planning draft.

### Plan home

Lead with “Where would you like to go?” and the selected area. Show a compact origin control, a destination list, and a rest-preference card. Initial places come from the downloaded catalog, with source names preserved. Local text filtering searches that catalog without an API call on each keystroke.

Offer destination filters such as “Art and views,” “Everyday places,” and “Places to sit.” A card shows its name, category, and straight-line proximity labeled “nearby”; walking distance appears only after routing. Unnamed benches receive neutral labels such as “Mapped bench,” with distance and area for disambiguation. Never invent a local name.

The first location request happens only after “Use my location.” When permission is denied or the location is imprecise, named starting places still work. A map pin is an alternative, not the only way to choose coordinates. Provide a visible “Use selected point” action rather than requiring a long press. Keep the configured area available when the person is elsewhere; label it as planning for that area.

Place details can be browsed before routing. The primary button, “Compare routes,” stays disabled until the origin, destination, and numeric preference are valid. Explain the missing field next to it. If the area contains no usable destinations, show the retrieval status and Retry; do not silently substitute fictional places.

### Route comparison

Place route cards and the rest ribbon before the map. Each route card includes total mapped distance, longest mapped stretch, number of counted stops, and a plain explanation. For example, with illustrative data:

```text
To the library                       Preference: 300 m

Direct
420 m total · longest mapped stretch 420 m
No planned seating stops

Via a mapped bench
510 m total · longest mapped stretch 270 m
90 m farther; includes one mapped seating stop
Within 300 m on mapped paths · seating and approach unconfirmed

[Start] ── 240 m ── [Bench] ── 270 m ── [Destination]

[View ordered steps]     [Show map]
[Choose this route]
```

The example assumes zero waypoint offsets; actual routes must expose offsets as described in §5. Show “About” or `≈` for displayed distances. Use exact unrounded values for comparison. Avoid green “safe” badges, health scores, and claims that a route is accessible merely because routing succeeded.

Changing the preferred distance recolors and relabels existing stretches immediately, without a network call. Keep the selected route stable while the person explores the preference. A separate “Find other stops” action can run a new bounded search. If no evaluated alternative is within the preference, say “None of the routes checked has mapped stretches this short.” Do not imply that every possible route was searched.

Use two cards when two meaningful choices exist. If a seat lies on the direct path, the difference may be the inclusion of a planned break rather than extra walking; say so. If no alternative is available, show one card with the actual reason. Never duplicate geometry to manufacture a comparison.

### Rest ribbon and assumption preview

Draw the ribbon with `react-native-svg`, but put labels and controls in ordinary React Native components. A vertical ribbon on narrow screens gives each stop a generous target; on a wider screen, a horizontal overview can sit above the same ordered list. Segment lengths can be proportional within bounded widths, while text always states the actual distance. Keep screen-reader order chronological.

Tapping the longest-stretch value highlights that segment and scrolls its list row into view. Tapping a stop opens its details. A button on the detail card, “Preview without this stop,” removes that stop as a rest boundary and joins the adjoining distances. The path stays unchanged, and the UI says “Same path, without resting here.” This is a useful experiment the person can undo immediately. It does not claim to have found a bypass route.

Provide “Find different planned stops” as a separate action that makes a new routing request. It replaces the resting waypoint; the resulting path may still pass the original place. Physical avoidance of a closed path would require a separately implemented avoidance constraint and is outside this release. A preview exclusion is temporary; a post-walk “not found” report is a private persistent exclusion until cleared. The two actions must not share hidden state.

### Place detail

Show the place type, source name, seating description, required attributes, and provenance. Use rows with “Yes,” “No,” or “Not mapped”; omit no row whose absence would imply a positive result. A useful bench card might read:

```text
Mapped bench
Backrest: not mapped
Armrests: yes, according to OpenStreetMap
Access restrictions: not mapped
Approach from route: unconfirmed
OpenStreetMap last edited: March 2025
Downloaded: November 16, 2026
```

The dates above are illustrative. Render actual values with their original precision. Put a source link behind “View OpenStreetMap entry.” Keep a source-edit date separate from a mapped review date and from the app’s download time. A positive personal report appears in its own “Your experience” section and does not overwrite public source data.

### Save, reopen, and use an outing

The save modal asks for a name, an optional private note of at most 500 characters, and a return arrangement. “Walk back” fetches a separately routed return through the selected stops in reverse order. “Return arranged separately” records the person’s choice without implying a booking. “Decide later” saves an outward-only draft that carries that label everywhere.

Saved outings show a miniature ribbon, the selected preference, source age, and return status. Reopening a snapshot first displays what was saved. “Refresh for today” fetches current place data and routes into a new comparison; show changes before replacing the saved version. A refresh never silently alters an outing currently being followed.

The outing guide is a sequence of planned segments and stops. “I reached this stop” advances manual progress; a separate “I rested here” records a break. Keep the last confirmed rest separate from the reached waypoint. If a stop is unavailable, show the joined planned distance from the last confirmed rest through the next planned rest, including distance already covered. For example, reaching an unusable bench after 240 m and continuing 270 m gives a 510 m planned uninterrupted stretch. Label this as distance along the planned path, not measured movement. Do not infer arrival or rest from elapsed time, steps, or coarse location. Preserve both states across backgrounding and offer replanning while stationary. The guide does not provide background turn-by-turn navigation or automatic rerouting.

After finishing or ending early, offer optional feedback: “Manageable,” “More tiring than expected,” or “Prefer not to say,” followed by a stop-specific question if the person wishes. Let the person reopen or repeat an outing without completing feedback. A saved card can carry a small personal note such as “You enjoyed this outing”; avoid streaks or pressure to exceed earlier distances.

## 4. Visual design and accessibility

Use a warm neutral canvas, dark text, and a restrained green accent for selection. Reserve amber for uncertainty and distinguish every status with text and shape as well as color. Suggested tokens are canvas `#F7F5EF`, surface `#FFFFFF`, text `#182A27`, secondary text `#53605B`, accent `#246B54`, and caution text `#765114` on `#FFF1CF`. Measure contrast in the implemented combinations rather than assuming the palette is sufficient.

Use the platform system font, with approximately 28-point page titles, 20-point card titles, 17-point body text, and 15-point supporting text. Allow font scaling. Use a spacing scale of `4, 8, 12, 16, 24, 32`, card corners near 16, and minimum 48-by-48 logical-unit targets. Keep core numbers in text, not embedded in map images or SVG paths.

Build layouts with `SafeAreaView`, nested `View` containers, Flexbox rows that wrap, and scrolling content above a bottom action area. Use `useWindowDimensions()` to switch to a side-by-side comparison/map layout around 720 logical units when sufficient height exists. On small phones or large text, cards remain vertical and the action area participates in scrolling if it would cover content. Modals use keyboard-aware layouts and visible close controls.

Expose button labels, selected states, heading roles, input errors, and progress summaries through React Native accessibility properties. Keep a route card’s explanatory text readable without swallowing its child buttons into one inaccessible group. Hide decorative SVG paths from accessibility so the same information is not read twice. On a route change, announce one concise summary after the change settles. Restore focus after closing place details and modals. The [React Native accessibility guide](https://reactnative.dev/docs/accessibility) documents platform differences; test VoiceOver and TalkBack separately.

The map is supplementary. Every selectable stop, route comparison, and warning has an equivalent list interaction. Reduced-motion mode disables ribbon interpolation and camera flyovers. For other users, a short 150–200 ms transition can connect the old and new ribbon; it must not delay the action. Haptics are optional and never the only feedback.

Create an original icon showing a path curving toward a simple seat. Use a recognizable silhouette at small sizes and no tiny lettering. Replace the existing icon, adaptive foreground, and splash assets; use the canvas color behind the splash motif. Keep startup independent of network completion, so a slow service does not trap the user on the splash. Verify the actual icon and launch screen in installed preview builds, as required by [Expo’s branding guidance](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/).

## 5. Place evidence and route calculations

### Separate three facts

1. **Mapped attributes:** what a source says about a place, including unknown fields.
2. **Routing evidence:** where the routing engine places each waypoint on its pedestrian network.
3. **Current physical availability:** whether someone can reach and use the seat now, which these APIs do not establish.

Model these separately. A recent fetch cannot improve the physical availability status. All core rest-distance results are conditional estimates on mapped paths, with unconfirmed access to the actual seat. Keep that qualification adjacent to the main result, not only in a help screen.

### Source dates

Store `sourceEditedAt`, `mappedCheckDate`, `mappedSurveyDate`, and `fetchedAt` independently. `check_date` can describe a data review and can be specific to an attribute; `survey:date` expresses a mapper’s recorded survey. Neither is an inspection performed by Benchmark. Preserve partial dates such as `2025-03` rather than inventing a day. Reject malformed or future dates as evidence and retain the raw text for diagnostics. See the OSM definitions for [check_date](https://wiki.openstreetmap.org/wiki/Key:check_date) and [survey:date](https://wiki.openstreetmap.org/wiki/Key:survey:date).

### Counting a stop

A first-release stop can divide a **mapped** walking stretch only when all of these conditions hold:

- Its source explicitly describes seating of a type the person has enabled.
- Every required seating attribute is affirmative. With “Require a backrest” on, missing or negative `backrest` excludes the stop. Missing material alone does not exclude a stop when material is not a requirement.
- No known restriction contradicts use: reject `access=no/private/customers`, `foot=no`, `locked=yes`, disused/removed objects, and personally excluded places. Treat other restricted, conditional, or unrecognized access values as unresolved and exclude them in this version.
- It is an outdoor point object with a usable coordinate. Ways and relations remain discoverable but do not become counted stops from their bounding-box centers.
- A route explicitly includes its coordinate as a waypoint and passes the waypoint checks below. Being near a line is insufficient.
- It is not a duplicate rest occurrence at the same position along the route.

For untimed outdoor places, a missing access tag is displayed as “Access not mapped,” and the result remains conditional. Missing access information must never become “Public access confirmed.” If opening hours or conditional restrictions are present, exclude that stop from counted rests in the first version unless the value is explicitly unrestricted, such as `24/7`; show it as a possible place. This deliberately avoids an incomplete hours parser. Indoor seating and timed venues need a separate later implementation.

Use `amenity=bench` as the baseline. A picnic table counts only if the person enables that seating type; no backrest is inferred. A shelter needs `bench=yes` or `picnic_table=yes`, must not be an animal/emergency-only shelter, and must pass the same requirements. Shelter-level backrest information is not automatically attributable to a particular seat: require an explicit seat object for a backrest requirement. Do not infer usable shade from tree cover or from a generic roof tag.

### Why a 15-metre corridor is only a search aid

Use Turf to identify and order candidates near the direct route, with a narrow 15 m band for “near this route” labeling and a wider 150 m corridor for potential detours. These distances are tunable prototype search limits. A candidate across a wall, on another level, or across an uncrossable road can fall inside either band.

Request each selected seat as an ORS waypoint. Set a bounded snapping radius, initially 10 m for all waypoints, and inspect the coordinates at the returned `way_points` indices. A snap beyond the configured bound, invalid indices, inconsistent waypoint order, or a missing route rejects that candidate. Never widen the radius silently to make a result appear.

Even a 2 m snap cannot prove a walkable connection to the seat. Display the measured offset and “Approach unconfirmed.” Do not draw a straight connector as a verified footpath or add its straight-line distance as if it were a routed distance. The main metric is explicitly **longest mapped stretch**; any unmodeled approach can make the actual walk longer. A future connected-footpath dataset could improve that estimate, but neither a waypoint nor a proximity threshold establishes physical access by itself.

### Bounded candidate search

Use this deterministic sequence, with all caps enforced on the server:

1. Validate the selected region and both coordinates. Fetch the direct walking route and the shared regional place cache independently. Limit the initial product to direct routes of at most 2 km; explain the supported range when exceeded.
2. Normalize and filter seating evidence. Project point candidates within the 150 m corridor onto the direct geometry. Divide its geometry length into thirds and retain up to eight candidates in each third, ordered by distance from the line, then stable OSM identity. This caps the pool at 24 without selecting only seats near the midpoint. For single-seat trials, rank by the largest estimated geometry stretch after splitting at that projection, then straight-line start → seat → destination distance, then ID. These are ranking proxies, never displayed routed distances.
3. Route through at most three distinct individual seat candidates: start → seat → destination. These are separate requests, not ORS’s unrelated automatic alternatives.
4. If no useful one-stop result fits, evaluate all ordered-by-projection pairs in that 24-seat pool locally, at most 276 pairs. For geometry length `L` and projection distances `a < b`, minimize `max(a, b-a, L-b)`, then the straight-line via-pair length, then the pair of stable IDs. Request only the best pair: start → seat A → seat B → destination. This is a heuristic, not an exhaustive routed search. Keep geometry units consistent within the proxy; final results always use provider leg distances.
5. Reject malformed routes, excessive snaps, and alternatives over 2.5 km or more than 50% longer than the direct route. These are disclosed search limits; “None found” is limited to this search.
6. Define a useful alternative as one with at least one counted rest that either changes an unmet mapped preference to a met preference, or reduces the longest mapped stretch by at least `min(25 m, 10% of direct distance)`. The first condition takes precedence: at a 300 m preference, improving 310 m to 290 m is useful even though the reduction is only 20 m. Rank useful survivors first by whether their mapped stretches fit the preference, then longest mapped stretch, then total distance, then stable IDs. Return the direct route plus the best alternative. Suppress exact duplicates of geometry and planned stop occurrences. Keep a same-path option when adding a planned rest makes it useful.

The outward search costs at most five routing calls: one direct, three single-stop candidates, and one pair. A separately requested return adds one call. Candidate requests run at concurrency two, with cancellation/deadlines and a total request budget; no per-pin fetch loop. Use cached geometry when only the numerical preference changes. A seating requirement change re-evaluates eligibility immediately, marks the existing search as limited, and offers an explicit new search.

The direct route initially has no planned seating waypoint, even if the catalog shows a nearby bench. To credit that bench, the via-seat request must establish a corresponding route candidate. This may produce the same path with a planned break, which is still a meaningful choice.

### Calculating stretches without unit or ordering mistakes

For a route with ordered waypoint legs `d₀…dₙ` in metres, accumulate successive legs until an eligible planned rest occurrence is reached. Emit that sum and reset. Always emit the final stretch to the destination. Excluded stops do not reset the accumulator. The total is the sum of all legs; the longest mapped stretch is the maximum emitted sum.

```ts
// Pure domain logic; validate finite, nonnegative distances before calling.
// restAfterLeg[i] says whether the waypoint reached by leg i counts as a rest.
export function mappedStretches(
  legMetres: readonly number[],
  restAfterLeg: readonly boolean[],
): number[] {
  if (
    legMetres.length === 0 ||
    legMetres.length !== restAfterLeg.length ||
    legMetres.some((m) => !Number.isFinite(m) || m < 0)
  ) {
    throw new Error("Invalid route legs or rest boundaries");
  }
  const stretches: number[] = [];
  let accumulated = 0;
  legMetres.forEach((metres, i) => {
    accumulated += metres;
    const isLast = i === legMetres.length - 1;
    if (isLast || restAfterLeg[i]) {
      stretches.push(accumulated);
      accumulated = 0;
    }
  });
  return stretches;
}
```

Use ORS leg distances as the authority for these calculations. Turf supports candidate proximity, geometry checks, and highlighting; avoid mixing a Turf-derived route length with ORS leg distances in one comparison. Set Turf units explicitly to metres. Current Turf documentation uses `totalDistance` and `pointDistance`, replacing older `location` and `dist` names; pin the installed version and normalize this in one adapter. [Turf nearestPointOnLine](https://turfjs.org/docs/api/nearestPointOnLine) documents both the units and the property migration.

Use waypoint indices and leg order to associate stops with a route. A global nearest-point projection can choose the wrong occurrence at a loop or intersection. Do not deduplicate a seat across the entire round trip: the same seat can legitimately be reached once outward and once returning. Deduplicate only coincident occurrences that would create a fictitious extra break.

Reject zero-total-distance routes and coincident endpoints before comparison; this version plans destination outings rather than generating loops. When a shelter and a separately mapped bench describe the same apparent seating opportunity, retain both source references but choose only one candidate for that location. Never count two rest boundaries within 5 m along a route as independent opportunities. This conservative duplicate rule may merge genuinely distinct adjacent seats, which has negligible effect on a short-walk comparison.

For the illustrative route `[240, 270]`, one counted stop gives a longest stretch of `270 m`; excluding it gives `510 m`. At a `250 m` preference, that route does not fit. A value of `300.4 m` must not fit a `300 m` preference merely because the display rounds to 300.

### The return belongs in the calculation

Request destination → reversed planned stops → origin, using the same profile and restrictions. Do not reverse the outgoing polyline and assume the result is a valid return route. Show outward and return metrics separately, plus the longest stretch for the complete outing.

Unless there is an eligible planned rest at the destination, join the last outward stretch to the first return stretch. For outward stretches `[240, 270]` and return stretches `[260, 250]`, with no rest at the destination, the complete outing has stretches `[240, 530, 250]`. Both directions can look acceptable separately while the combined outing exceeds the preference. A library or café destination does not automatically reset that calculation.

If return routing fails, preserve the outward plan and label the return unresolved. A separately arranged return has no computed walking-back metric. An outward-only draft cannot be displayed as a complete walking round trip.

## 6. APIs, cache policy, and operating limits

### OpenStreetMap discovery

Send a bounded Overpass query from the server, with numeric coordinates generated from a configured region. Do not accept arbitrary Overpass QL from the phone. This is an executable discovery query for the proposed Stanford area, not a claim that these objects are currently present:

```overpass
[out:json][timeout:15];
(
  nwr["amenity"="bench"](37.420,-122.180,37.435,-122.160);
  nwr["leisure"="picnic_table"](37.420,-122.180,37.435,-122.160);
  nwr["amenity"="shelter"](37.420,-122.180,37.435,-122.160);
  node["tourism"~"^(artwork|viewpoint)$"]["name"]
      (37.420,-122.180,37.435,-122.160);
  node["amenity"~"^(library|cafe|community_centre)$"]["name"]
      (37.420,-122.180,37.435,-122.160);
);
out meta center;
```

POST the query as form field `data` to `https://overpass-api.de/api/interpreter`. Use a descriptive application User-Agent. Normalize responses immediately, retaining only fields the app uses. A stable identity combines element type and ID, such as `node/123`; IDs alone collide between nodes, ways, and relations. Preserve source version and timestamps, while discarding contributor identity fields if present.

`out meta` provides version/timestamp information; `center` for a way or relation is the center of its bounding box. It does not identify an entrance or a point on a walkable path. See the [Overpass output-format documentation](https://dev.overpass-api.de/overpass-doc/en/targets/formats.html). Area objects can appear with “Location approximate,” but cannot become routed rest waypoints. Keep `displayCoordinate` separate from `routingPoint`, which can be absent. A named venue node is also not automatically a building entrance.

For first-release named endpoints, use point landmarks and show “Approach unconfirmed.” An unroutable venue offers nearby point landmarks as unverified approach choices, labeled with their names and straight-line relation to the venue; it does not substitute a point silently. The next explicit comparison checks the selected point within the normal request budget. Call a point routable only when a still-current cached route demonstrates that fact. The person chooses the approach point as the actual destination. A later entrance adapter can associate mapped entrances with buildings. The first-release coverage gate must demonstrate useful routable point destinations.

Keep one normalized cache record per region and query version, with a 24-hour refresh target. Concurrent misses share one refresh using a database lease expiring after 30 seconds. On timeout, retain the last successful result and its original fetch time. Old data remains browsable, but an expired cache produces an incomplete comparison until refreshed. It does not become current because the app reopened it.

Validate HTTP status, content type, JSON shape, and Overpass’s error/`remark` field. An HTTP 200 containing a timeout or partial result is not an empty successful response. Reject incomplete refreshes without replacing the cache. Apply a 2 MB response-size limit and 2,000-element cap. On overflow, report that the area needs narrowing instead of treating truncated data as complete.

Public Overpass is appropriate only for this bounded research prototype with restrained, cached use. Its operator warns against depending on public instances as an application backend. Caching does not grant permission for unlimited public deployment. Beyond the class trial, use a managed extraction service or an operated instance with a documented refresh strategy. [Overpass resource guidance](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html)

### Walking routes

Use the current hosted endpoint:

```text
POST https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson
Authorization: <server-side ORS key>
Content-Type: application/json
```

The provider moved from `api.openrouteservice.org` to the HeiGIT host, with the old host’s shutdown scheduled for November 2–6, 2026. Implement against the new host. The [migration announcement](https://ask.openrouteservice.org/t/deprecating-api-openrouteservice-org-in-favour-of-api-heigit-org/7912) supplies replacement paths, and the [API landing page](https://api.heigit.org/) describes obtaining a Standard key.

Construct a request with `coordinates: [origin, seat, destination]`, all as `[longitude, latitude]`; `radiuses: [10, 10, 10]`; `units: "m"`; `instructions: true`; and `preference: "shortest"`. Omit the seat and corresponding radius for the direct route. Keep the same settings for comparable candidates. Do not enable waypoint optimization, skip route segments, or suppress warnings. The provider’s [directions schema](https://github.com/GIScience/openrouteservice-docs/blob/master/API%20V2/swagger.json) describes the radius and preference fields; verify against the hosted service during the first implementation experiment.

Normalize the GeoJSON feature, `properties.summary`, `properties.segments`, and `properties.way_points`. Retain attribution, request time, and available engine metadata. Assert that leg count equals waypoint count minus one, indices are valid and ordered, coordinates are finite and in range, and leg distances sum to the summary within `max(2 m, 0.5%)`. A malformed route becomes an unavailable candidate. ORS documents its [request and response structure](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/requests-and-return-types).

Use a server secret for ORS. Neither that secret nor a Supabase service-role key belongs in an `EXPO_PUBLIC_` variable or the mobile bundle. Recheck current quotas in the team’s provider account during setup; this plan does not assume a permanent request allowance.

### Backend interface

Implement one Supabase Edge Function, `outing-api`, with validated actions and separate provider-adapter files.

| Action | Validated request | Response and UI effect |
|---|---|---|
| `places` | Supported `regionId`. | Normalized seats and landmarks, cache timestamps, completeness; updates destination choices. |
| `compare` | Region, endpoints, seating requirements, distance preference, private exclusions, request ID. | Direct route, best evaluated alternative, rejection reasons, search limits, source ages. |
| `return` | Region, endpoints, ordered stop IDs, profile/restrictions from the selected plan. | Separately routed return; updates full-outing comparison. |

Verify the Supabase access token and derive the user from it. Validate region membership, coordinate ranges, maximum four waypoints, allowed enum values, and request sizes with Zod. Resolve stop coordinates from the server catalog. Return structured errors such as `LOCATION_OUTSIDE_AREA`, `NO_ROUTABLE_POINT`, `SOURCE_UNAVAILABLE`, and `RATE_LIMITED`, with recoverable messages. Never proxy a caller-supplied URL or trust a supplied `ownerId`.

Use a 10-second deadline per routing call and a 25-second comparison deadline. Return completed candidates with `searchComplete: false` if the total deadline expires. The client deadline is slightly longer, with explicit cancellation. Query keys and request revisions prevent late results from an earlier destination replacing the current draft.

Cache routes privately per user for 15 minutes, keyed by ordered coordinates, profile, restrictions, and adapter version. Keep source-place cache versions separate so geometry can be re-evaluated against changed eligibility. Evict expired route payloads within 24 hours. Do not expose origins through shared public route-cache rows.

Enforce budgets in Postgres so separate Edge Function instances share the limit. Start with one comparison in flight per user, ten comparisons per five minutes per user, and a team-wide provider budget below the account allowance. Charge each outgoing provider call atomically. Apply an IP-based abuse limit because anonymous accounts can be recreated. Honor `Retry-After`; failed provider calls get an explicit Retry action rather than multiplying automatic retries across server and client. Repeated client request IDs reuse the in-flight or completed result rather than restarting the five-call search.

### Maps and attribution

Choose `react-native-maps`, installed through `npx expo install`, using Apple Maps on iOS and Google Maps on Android. This avoids a separate tile service for the core. Configure the Android Maps SDK key with app-package and signing-fingerprint restrictions, including the actual preview build. That client map key is distributed in the binary and protected by restrictions; the routing key remains secret. Follow [Expo’s map deployment guide](https://docs.expo.dev/versions/latest/sdk/map-view/), including dynamic app configuration for environment variables.

Show OSM attribution for places and ORS attribution for routes, while preserving native map-provider credits. Include credits on the list-only view. [OSM’s copyright page](https://www.openstreetmap.org/copyright) explains attribution and database licensing. Do not add bulk tile downloads or assume the public OSM tile server is a free offline service; its [tile policy](https://operations.osmfoundation.org/policies/tiles/) sets separate conditions.

If the map fails, comparison cards, directions, and the ribbon remain usable. The downloaded place list avoids adding geocoding to the core. Public Nominatim forbids client autocomplete and imposes application-wide limits, so it is not an unexamined address-search fallback. [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/)

## 7. React Native architecture and one-way data flow

### What already exists

The local `benchmark` project declares Expo `~58.0.22`, React Native `0.88.1`, React `19.3.0`, TypeScript `~6.0.3`, and Expo Router. These are observed declarations, not a newly validated installation. Its `_layout.tsx` renders a `Slot`, and `index.tsx` is a placeholder. It has branding placeholders, EAS profiles, and a typecheck command. It does not yet have Supabase authentication, route analysis, a test runner, or the proposed feature screens.

Retain the starter, lockfile, and teaching team’s build-identity workflow. Do not create another app or upgrade the framework incidentally. The older shared guide’s statement that the starter was unavailable no longer applies to this workspace.

### Module layout

```text
benchmark/
├── src/app/
│   ├── _layout.tsx                       providers and root Stack
│   ├── (tabs)/_layout.tsx                Tabs
│   ├── (tabs)/plan/{_layout,index,compare}.tsx
│   ├── (tabs)/saved/{_layout,index,[id]}.tsx
│   ├── (tabs)/preferences/{_layout,index,data}.tsx
│   ├── places/[id].tsx
│   ├── outings/[id].tsx
│   └── modals/{save,feedback}.tsx
├── src/components/                       cards, ribbon, controls
├── src/features/planner/                 reducer, selectors, query hooks
├── src/features/outings/                 save/reopen/progress/feedback
├── src/services/                         Supabase, location, local storage
├── src/theme/                            color, type, spacing tokens
├── shared/                              pure TypeScript contracts and logic
│   ├── contracts.ts
│   ├── eligibility.ts
│   └── routeMetrics.ts
├── supabase/functions/outing-api/        handler and provider adapters
├── supabase/migrations/                  tables, policies, private caches
└── tests/                               fixtures and behavior tests
```

Brace notation summarizes separate files. Keep route files thin and calculations outside React components. `shared/` contains no React Native, navigation, network, or storage imports. Compile it in both app and Edge Function checks with supported explicit imports. Put Turf calls in environment adapters with pinned dependency resolution, not browser globals or unversioned CDNs.

### Data contracts

Use named longitude/latitude tuple types. Normalize missing booleans to a three-state enum; `Boolean(tag)` is wrong because the string `"no"` is truthy.

```ts
type LonLat = readonly [longitude: number, latitude: number];
type KnownBoolean = "yes" | "no" | "unknown";

interface Place {
  id: string; // OSM type/id
  role: "seat" | "landmark";
  kind: "bench" | "picnic_table" | "shelter" | "artwork"
    | "viewpoint" | "library" | "cafe" | "community_centre";
  name: string | null;
  displayCoordinate: LonLat;
  coordinateKind: "node" | "area_center";
  routingPoint: LonLat | null;
  tags: Readonly<Record<string, string>>;
  seating: KnownBoolean;
  backrest: KnownBoolean;
  sourceEditedAt: string | null;
  mappedCheckDate: string | null;
  mappedSurveyDate: string | null;
  fetchedAt: string;
}

interface PlannedStopOccurrence {
  occurrenceId: string; // distinct on outward and return journeys
  placeId: string;
  waypointIndex: number;
  snappedCoordinate: LonLat;
  snapOffsetMetres: number;
  counted: boolean;
  exclusionReasons: readonly string[];
  approach: "unconfirmed";
}

interface RouteAnalysis {
  legMetres: readonly number[];
  stretchesMetres: readonly number[];
  totalMetres: number;
  longestMappedStretchMetres: number;
  withinMappedPreference: boolean;
  availability: "unconfirmed";
}
```

Complete these contracts with validated geometry, ordered instructions, requested/snapped endpoints, timestamps, source versions, profile/options, and snapshot schema version. Keep `withinMappedPreference` and `availability` separate; there is no `safe`, `canWalk`, or `accessible` boolean. The server and client share eligibility and metric functions so the card, ribbon, snapshot, and screen-reader description cannot compute different answers.

### State ownership

Use `useReducer` plus context for endpoints, preference, required attributes, selected route ID, preview exclusions, and submitted request revision. Keep transient details such as an expanded row in local `useState`. TanStack Query owns remote catalog/comparison responses and saved-outing reads; explicit mutations handle saves and feedback. Include the authenticated owner ID in every personal query key, including comparisons containing coordinates. On identity change, cancel and remove personal queries and reset private in-memory draft/selection state before loading the new identity. Old local copies remain explicitly labeled and use the manual-copy flow in §8. Avoid mirroring remote records into another independent global store.

```text
Pressable / TextInput event
          │
          ▼
Planner reducer ── submitted revision ──► Query hook ──► outing-api
          │                                      │
          │                                validated response
          │                                      │
          └──────────► shared selectors ◄─────────┘
                              │
                    immutable view model
                              │
                cards + ribbon + map + accessible list
```

Derive counted stops, joined stretches, match wording, and selected geometry with pure selectors. Use `useMemo` where repeated geometry work warrants it. Child components receive props and emit actions; they never mutate route objects or write to Supabase while rendering.

Model loading as `idle → loading → ready | partial | error`. Changing a destination invalidates the selected comparison and disables Save until the current revision resolves. Changing only the numeric preference retains geometry and selection. Prevent stale responses with both `AbortController` and revision checks; cancellation alone does not guarantee the server stopped. Keep the displayed preference and its computed metrics from the same revision.

Connect Query’s focus and online managers to `AppState` and network status. Install listeners once and remove them on cleanup. Disable automatic foreground refetch for an active outing snapshot; Refresh is explicit. The [TanStack React Native guide](https://tanstack.com/query/latest/docs/framework/react/react-native) describes lifecycle integration. A connectivity indicator is a hint; requests still require their own error handling.

### Purposeful additional libraries

| Addition | Feature it earns |
|---|---|
| `react-native-maps` | Native route polylines and place markers. |
| `react-native-svg` | Rest ribbon and saved-outing diagrams. |
| Individual Turf modules | Proximity, projection, and geometry checks: `@turf/helpers`, `@turf/distance`, `@turf/length`, `@turf/nearest-point-on-line`. |
| `@tanstack/react-query` | Request states, cache keys, invalidation, mutation lifecycle. |
| `zod` | Runtime validation of responses, snapshots, and endpoint inputs. |
| `@react-native-async-storage/async-storage` | Persistent Supabase session using the documented RN integration. |
| `@react-native-community/netinfo` | Online status and offline messaging. |
| `@supabase/supabase-js` and its required RN compatibility support | Authentication and private database operations; do not count Supabase toward the additional-library requirement. |
| `expo-location`, `expo-sqlite` | Foreground position and transactional local saves. These are Expo capabilities; third-party evidence comes from the rows above. |

Install native libraries with `npx expo install` and JS-only packages with npm. Use the course’s Node version, record resolved versions in the lockfile, and run Expo compatibility checks before a shared build. Do not add another navigation system, form framework, animation framework, or state library without an implemented need.

## 8. Supabase, private history, and offline saves

### Authentication without onboarding work

On the first connected launch, create an anonymous Supabase session once and persist it. Reuse that identity after restart. An anonymous user receives an authenticated user ID; this differs from using a public API key without a user session. The [anonymous sign-in documentation](https://supabase.com/docs/guides/auth/auth-anonymous) covers identity behavior and abuse controls. Follow the [React Native session setup](https://supabase.com/docs/guides/auth/quickstarts/react-native) for persistence and foreground token refresh.

Explain in Data and privacy that reinstalling, clearing storage, or losing the session may make cloud history unrecoverable. Account linking can come later. If authentication is unavailable, retain local drafts and saved copies, show “Cloud save unavailable,” and retry without fabricating an identity. A new identity cannot silently inherit another identity’s queued writes.

Configure anonymous-signup rate limits and test the class demonstration under the shared network’s IP limit. Before public distribution, implement and test an appropriate abuse-control flow, such as the provider’s supported CAPTCHA approach. Per-user API quotas alone cannot prevent anonymous-account farming.

### Database tables

| Table | Fields and constraints | Access |
|---|---|---|
| `route_preferences` | `owner_id` primary key, `max_gap_m`, `require_backrest`, `allow_picnic_tables`, validated `excluded_place_ids` array (maximum 100), `updated_at`, `revision`; bounds/non-null checks. | Owner only. |
| `saved_outings` | UUID `id`, `owner_id`, `name`, `note`, JSONB `snapshot`, `schema_version`, `return_mode`, timestamps, `revision`, nullable `deleted_at`; unique `(id, owner_id)`. Deleted rows retain only a minimal retry marker. | Owner only; normal reads exclude deleted rows. |
| `outing_feedback` | UUID `id`, `owner_id`, `outing_id`, stable `submission_id`, `manageability`, optional `place_id`/`stop_result`, `created_at`; unique `(owner_id, submission_id)`. | Owner only, with same-owner parent constraint. |
| `private.place_cache` | Region/query-version key, normalized payload, fetch time, completeness, refresh lease. | Server only; public source data. |
| `private.route_cache` | Owner/request-hash key, payload, expiry. | Server only; short retention. |
| `private.api_budgets` | Atomic user/IP/global counters and active-request leases. | Server only. |

The snapshot stores the chosen outward route, optional return, ordered stop occurrences and source fields, preferences, source ages, exclusions, and attribution. Return mode is `walk`, `arranged`, or `undecided`. A `walk` plan requires a valid return route; `undecided` always renders as outward-only. Bound snapshot size, text lengths, coordinate counts, and accepted schema versions. Validate snapshots before use and show an update-required state for unsupported versions.

For an active row, require a valid name/snapshot. For a deleted row, require name, note, and snapshot to be null. Retain its UUID, owner, revision, and deletion timestamp as a server deletion marker so a delayed original insert cannot recreate the outing. Preserve these markers throughout the prototype; removing them safely belongs to the deferred account-reset protocol.

Enable row-level security on every exposed table, with only necessary grants to authenticated users. Updates need both `USING` and `WITH CHECK`. For example:

```sql
alter table public.saved_outings enable row level security;

create policy "owner selects outings" on public.saved_outings
for select to authenticated
using ((select auth.uid()) = owner_id and deleted_at is null);

create policy "owner inserts outings" on public.saved_outings
for insert to authenticated
with check ((select auth.uid()) = owner_id and deleted_at is null);

create policy "owner updates outings" on public.saved_outings
for update to authenticated
using ((select auth.uid()) = owner_id and deleted_at is null)
with check ((select auth.uid()) = owner_id and deleted_at is null);

-- No direct DELETE grant/policy. Use the owner-validated deletion RPC.
```

Apply corresponding owner policies to preferences and feedback. Enforce feedback ownership with composite foreign key `(outing_id, owner_id)` referencing `saved_outings(id, owner_id) ON DELETE CASCADE`. A future physical purge cascades; ordinary app deletion retains the marker and explicitly deletes feedback in the same transaction. Feedback creation requires an active parent. Independent exclusions remain until separately cleared. Index `(owner_id, updated_at desc)` for saved lists and `(owner_id, outing_id)` for feedback. The [Supabase RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security) explains policy semantics; these tables are the proposed app design.

Implement `delete_outing` as a transaction that verifies `auth.uid()`, locks the owned row, increments revision, sets `deleted_at`, scrubs personal content, and deletes its feedback. Retrying an already completed deletion returns its marker without changing the outcome. Deletion, edits, and feedback creation lock the same outing row and recheck active/deleted state after obtaining the lock. Give clients no direct feedback-insert grant that bypasses this check. Mutation/status RPCs needing privileges unavailable to the client use `SECURITY DEFINER` with a fixed empty search path, fully qualified table names, an explicit authenticated-owner check, and restricted execute grants. An owner-validated status RPC may return the minimal deletion marker to resolve retries; ordinary lists never expose it as an outing.

Use the user’s token for ordinary database operations. Service-role access is confined to validated cache/budget handlers; it bypasses RLS and needs explicit scope checks. Keep the private schema unexposed to the Data API and revoke client grants. Personal reports never update the shared OSM cache, create public verification badges, or edit OpenStreetMap automatically.

### Save lifecycle

Use SQLite for local snapshots and a bounded pending-write table. This is a single-device queue, not a general synchronization engine.

```text
Save pressed
    │
    ▼
SQLite transaction: snapshot + pending operation, stable UUID
    │
    ├── offline/auth unavailable ──► Saved on this phone · Retry
    │
    └── server write succeeds ─────► Saved to your private history
                                         │
                                         ▼
                                  fetch/reconcile Saved list
```

Create the UUID before the first save and reuse it after a timeout. Creation uses INSERT, never an upsert over an existing UUID. Preserve ownership in the queue and process operations sequentially. On a uniqueness conflict or uncertain response, retrieve the owned operation state: an active record can be reconciled by revision, while a deletion marker ends the retry without recreating content. Edits use an atomic expected-revision update on an active row; a conflict prompts reload. Disable duplicate submit while a write is active.

Represent local state as `local-only`, `pending`, `synced`, or `conflict`. On restart, load the local copy first and resume only writes belonging to the current identity. After session loss, keep copies readable and require “Save a copy to this session,” with a new UUID. Offline deletion needs a local pending-delete marker; call the transactional deletion RPC after reconciling prior operations. Remove the local pending operation after acknowledgement, while retaining the server deletion marker. If a never-synced UUID has no outstanding request, cancel its local creation instead of contacting the server.

Feedback uses a stable submission ID. A personal “not found,” “closed,” or “unusable” result excludes that place in future searches until cleared in Preferences. Positive feedback does not upgrade source certainty. Store those exclusions as explicit owner-scoped preference data, so deleting an outing does not accidentally erase a deliberate exclusion. Neither feedback nor exclusions are required for first use.

### Data minimization

Keep endpoints inside private snapshots and short-lived routing caches. Request foreground position only when needed; collect no continuous track. Send no personal notes, feedback, or health information to external place/routing APIs. Disable request-body logging; operational logs need request ID, timing, status, and provider error category.

SQLite history and the standard AsyncStorage session adapter are not an encrypted vault. Avoid diagnoses and unnecessary location history. Provide individual outing deletion, including its feedback, and controls to clear personal exclusions and reset preferences. Display pending deletion when offline. Defer an account-wide “Delete my app data” operation: it needs a server-side barrier against all pending writes and private route-cache cleanup, beyond individual record deletion. Do not offer a reset button that clears the phone while queued writes can recreate cloud data. Privacy text identifies the backend and map/routing providers involved.

## 9. Optional features and scope boundaries

### Weather: the first optional addition

After the complete core journey works, add a forecast row for the intended outing time. Use Open-Meteo hourly `temperature_2m`, `precipitation_probability`, and `wind_speed_10m` with `timezone=auto`. Send the area center, not a personal route history. Cache by area/forecast hour for 30 minutes, preserve units and timestamps, and show unavailable data without blocking comparison. [Open-Meteo forecast documentation](https://open-meteo.com/en/docs)

Weather can prompt “Review your rest preference” or highlight explicitly mapped covered seating. It must not automatically reduce someone’s limit, infer shade from a park, or label conditions medically safe. The free endpoint has noncommercial-use and request-limit conditions; recheck the [provider’s terms](https://open-meteo.com/en/terms) before expanding distribution.

### Gait and mobility

Do not include a calibration walk in onboarding. Step counts alone cannot establish comfortable walking distance, fatigue, balance, or a suitable rest interval. A later voluntary observation could show steps and elapsed active time, followed by the person choosing a preference; the core does not need that experiment.

If adding a pedometer, check availability and permission, handle missing events, unsubscribe, and mark interruptions as incomplete sessions. Expo’s current documentation requires an Android development build for pedometer access, says background updates are not delivered, and limits historical step queries to iOS. Do not promise equivalent historical capture across platforms. [Expo Pedometer](https://docs.expo.dev/versions/latest/sdk/pedometer/)

Defer HealthKit and Health Connect. They introduce separate native integrations, consent, data availability, and testing. Apple exposes [Walking Steadiness](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/applewalkingsteadiness), while Android documents its own [Health Connect data types and permissions](https://developer.android.com/health-and-fitness/health-connect/data-types). Do not invent a shared steadiness field or reinterpret missing data as a normal result.

### Wheelchair routing

ORS has a `wheelchair` profile with surface, incline, kerb, and width constraints. It is a viable extension after testing intended users’ needs and regional data. Include profile/options in cache keys and snapshots. Never fall back to `foot-walking` on a wheelchair-route failure. [ORS routing options](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/routing-options)

A wheelchair user may remain seated while resting, so a bench is not automatically the right waypoint. This mode needs a “place to pause” definition considering space, approach, gradients, and personal preferences. Unknown clearance or a park centroid cannot satisfy it. Ship only after defining those fields and testing the available data and both mobile platforms; otherwise omit the mode rather than displaying a cosmetic accessibility toggle.

### Not in scope for the first release

| Deferred work | Reason and prerequisite |
|---|---|
| Worldwide discovery/address autocomplete | Adds location-search operations before local usefulness is established. Revisit after coverage validation. |
| Public reports, photos, and moderation | The app must work without reports; public claims add moderation and freshness obligations. |
| Live turn-by-turn guidance/background tracking | Requires navigation-grade rerouting and platform background behavior. |
| General multi-stop optimization | The bounded one/two-stop search is inspectable. Expand only if observed outings need more stops. |
| Automatic fitness/fall-risk scores | Available inputs do not justify the outputs or added data collection. |
| Indoor seating/business-hour inference | Needs seating/access evidence, entrances, complete hours parsing, and potentially another provider. |
| Transit bookings or guaranteed transport | Recording a return arrangement does not reserve a service. |
| Cross-device recovery/synchronization | Add account linking and conflict UX after the single-device journey works. |
| Account-wide data reset | Requires a server-enforced barrier against queued writes. Individual outing deletion and preference controls ship first. |

## 10. Construction sequence and acceptance gates

### Phase 1 — Prove data and native dependencies, 6–10 person-hours

Work in the existing `benchmark` application, using Node.js 22.23.3 as specified by its README. Begin with `npm ci`, `npm run typecheck`, `npx expo install --check`, and `npx expo-doctor@latest`. These are implementation instructions, not checks performed for this document.

Install only the proposed dependencies:

```sh
npx expo install react-native-maps react-native-svg expo-location expo-sqlite \
  @react-native-async-storage/async-storage @react-native-community/netinfo
npm install @tanstack/react-query @supabase/supabase-js zod \
  react-native-url-polyfill @turf/helpers @turf/distance @turf/length \
  @turf/nearest-point-on-line
```

The build leader follows the starter README’s teaching-team configuration before shared EAS builds: assigned owner/project, unique iOS/Android identifiers, scheme, and development-client setup. Keep placeholders out of registered builds. Configure the Android map key, build both platforms, and verify a real map, one polyline, and a tappable marker. Retain the list/ribbon if the map is temporarily unavailable; resolve native compatibility before polishing map interactions.

Create an isolated development Supabase project, enable anonymous sign-in, and configure server secrets. Commit `.env.example` with public placeholders and names of required server secrets, never real credentials. Document private setup separately. Configure the supported region in one backend file, not throughout screen components.

Run one complete regional discovery and record: total objects by type, point seats, required-attribute coverage, excluded/restricted objects, and routable point destinations. Route real candidate outings and record snap offsets and failure reasons. The gate requires at least one useful real comparison with an eligible planned seat and two usable named endpoint choices. It does not require local inspection or user-created records.

If coverage fails, first check whether genuine picnic tables or seating-tagged shelters improve it without relaxing the rules. Next try another small documented area through the same automated query. If no area supports the experience, retain the bench-centered concept as a limited prototype and report the coverage limitation; do not replace seats with unsittable landmarks to manufacture success. Backrest scarcity must remain visible when the requirement is enabled. A simulated comparison can test the UI, but cannot pass this real-data gate.

### Phase 2 — Establish contracts and route analysis, 10–14 person-hours

Implement Zod input/output schemas, normalization, source-date handling, eligibility, and stretch calculations before screen-specific logic. Add deterministic fixtures for a direct path, one-seat path, two-seat path, unknown backrest, area center, and a return without a destination rest. Record fixture provenance; synthetic fixtures must say so.

Configure Jest through `jest-expo` and use React Native Testing Library for interaction tests after checking peer compatibility with the starter. Add `test` and appropriate backend-check scripts. [Expo’s unit-testing guide](https://docs.expo.dev/develop/unit-testing/) describes its Jest integration. The gate is passing behavior tests for the arithmetic and excluded-stop rules, not screenshot snapshots of components that merely render.

### Phase 3 — Connect discovery and comparison, 12–16 person-hours

Implement `outing-api`, private caches, bounded candidate search, deadlines, cancellation, and budgets. The server validates upstream payloads before returning them. Build Plan home and route cards against those responses. The visible total, longest stretch, and map must all change after a real request.

The gate exercises no seats, no route, stale place cache, partial search, and an out-of-order response. Confirm in a request log that repeated preference changes make no routing calls. Account for every provider request against the search budget.

### Phase 4 — Finish the main interaction, 10–14 person-hours

Implement the ribbon, equivalent ordered list, place details, and assumption preview. Make route selection and highlighting flow through the same state. Add return routing and complete-outing metrics. Preserve drafts across tab changes and modal dismissal.

The gate is a person completing Plan → Compare → inspect a stop → preview its absence → restore it → choose a return. At 200% text, all controls remain operable and the same journey works without interpreting the map.

### Phase 5 — Persist and reopen, 10–14 person-hours

Apply migrations in the development database, implement RLS, save/reopen/edit/delete, optional feedback, and the local pending-write queue. Test with two real anonymous identities, including direct database requests that bypass the UI. Persist guide progress and last confirmed rest separately.

The gate includes a real Supabase insert followed by a fresh read after app restart, an edited note retrieved again, a dropped-response retry producing one record, and a denied cross-owner read/update. Test offline save and identity loss. An in-memory cache does not satisfy the database requirement.

### Phase 6 — Accessibility, failure handling, and observation, 12–18 person-hours

Run VoiceOver and TalkBack through the complete journey. Test permission denial, app backgrounding, lost network, map failure, stale plans, and the keyboard in modals. Compare iOS and Android behavior rather than assuming shared TSX produces equivalent native interactions.

Conduct at least two small usability rounds on the planning interface; participants do not need to perform an unsupervised endurance test. Ask them to identify the longest stretch, explain extra distance, recognize unknown backrest information, and explain what happens if a seat is unavailable. Test the same tasks with the map hidden. Use observed confusion to revise labels and hierarchy. Record findings, not invented success rates.

### Phase 7 — Distribution and demonstration, 8–10 person-hours

Replace branding assets and confirm icon/splash behavior in cold-launched preview builds. Validate actual Android signing-key restrictions and iOS device provisioning. Generate installable iOS and Android previews through the configured EAS project. The starter’s README gives platform commands and notes that installing preview can replace the development app with the same identity.

Run typecheck, domain/component tests, backend checks, and database-policy tests on the final code. CI should run deterministic checks on pull requests using synthetic/recorded fixtures. Keep credentialed provider smoke tests separate and rate-limited; they should not consume routing quotas on every component edit. Document setup, provider configuration, source attribution, supported area, and known limitations. A clean checkout should reproduce the app with the private configuration supplied by the team.

Demonstrate: select a destination; fetch real routes; change the preference; remove a stop in preview; show the joined stretch; inspect provenance; add the return; save; restart and retrieve; submit optional feedback; show one permission or data-failure state. Include a screen-reader segment and the branded cold launch. Do not present fixtures as live results.

### Effort and ownership

The phases total **68–96 active human person-hours**, with coding assistance assumed. This is an estimate, not a measured schedule. It includes native builds, offline persistence, accessibility testing, and review, so it replaces the earlier inspection-based estimate. Weather may add another 4–6 hours after the core. Gait and wheelchair modes are not hidden inside this estimate.

For a team, agree on shared contracts first, then divide independent modules:

| Workstream | Modules | Depends on |
|---|---|---|
| Shared contracts and metric tests | `shared/`, domain fixtures | Feasibility experiment. |
| A: discovery and routing | Edge Function, private cache/budget migrations | Shared contracts. |
| B: planning interaction | `features/planner`, components, Plan routes | Shared contracts; adapter fixture initially. |
| C: private history | `features/outings`, storage, owner-table migrations | Shared contracts. |
| Integration and device QA | App layouts, build config, full journey | A, B, and C. |

A and B can proceed concurrently after contracts settle. C can also proceed if one person owns migration ordering and shared Supabase setup; otherwise sequence its migrations with A. Assign one owner to dependency changes, root providers, and navigation layouts. Keep refinements to shared contracts coordinated rather than letting each screen invent its own model.

## 11. Verification specification

All tests below are requirements for implementation. None is represented here as a passing mobile or backend test. Use live provider requests only for the feasibility and final smoke checks; deterministic tests should use small labeled fixtures.

### Numeric and evidence cases

| Test | Input or trigger | Required result |
|---|---|---|
| Direct path | One 420 m leg, no rests. | Total and longest stretch both 420 m. |
| One rest | Legs `[240,270]`, first boundary counted. | Stretches `[240,270]`; longest 270 m; fits a 300 m mapped preference. |
| Excluded rest | Same path, required backrest missing. | One 510 m stretch; exclusion explains the missing backrest. |
| Unknown middle stop | Legs `[150,180,170]`; first stop counts, second does not. | Stretches `[150,350]`; longest 350 m. |
| Unrounded boundary | Longest 300.4 m, preference 300 m. | Does not fit even if display rounding shows 300. |
| Small improvement crosses preference | Direct 310 m, alternative longest 290 m, preference 300 m. | Retain the alternative despite improving less than 25 m. |
| Return without destination rest | Outward `[240,270]`, return `[260,250]`. | Complete-outing stretches `[240,530,250]`; total 1,020 m. |
| Seat visited twice | Same OSM ID on outward and return routes. | Two distinct occurrences, in their actual route order. |
| Near a line only | Bench 8 m away without an explicit routed waypoint. | Display as nearby; no rest boundary. |
| Excessive snap | Requested seat snaps 35 m away with a 10 m bound. | Reject candidate; no silent radius increase. |
| Landmark-only stop | Artwork or café has no explicit eligible seating. | Destination/orientation role only. |
| Shelter without seating | `amenity=shelter`, no seat evidence. | Cannot split a seated-rest stretch. |
| Picnic table preference | Valid table with the setting disabled/enabled. | Excluded/enabled respectively, still subject to required attributes. |
| Area center | Way/relation returned with `center`. | Approximate discovery marker, never a counted seat waypoint. |
| Duplicate mappings | Bench and shelter refer to one apparent seating location. | One rest boundary and preserved source references. |
| Invalid geometry/data | Empty legs, NaN, mismatched arrays, bad indices, reversed lat/lon. | Validation error, never zero-distance success. |
| Source dates | Fresh edit, missing survey; partial or future date. | Honest independent date labels; no inferred inspection or invented precision. |
| Reached but not rested | Reach the bench at 240 m, mark it unavailable. | Next 270 m gives a 510 m planned stretch from the last confirmed rest. |

Implement these primarily in `tests/routeMetrics.test.ts`, `tests/eligibility.test.ts`, and `tests/providerAdapters.test.ts`. Test both ordinary results and rejected inputs. Do not assert that geometric proximity proves real-world access; that is deliberately outside the model.

### Integration and failure coverage

```text
REQUIRED TESTS — implementation pending

Discovery adapter
├── valid node/way/relation payload → normalized catalog        [unit]
├── timeout, HTML, malformed JSON, partial remark → retain old  [unit/integration]
└── concurrent misses → one refresh; expired lease recovers    [integration]

Comparison
├── direct + candidates → bounded calls + deterministic result [integration]
├── late response for previous destination → ignored           [component]
├── preference changes → local recomputation, zero HTTP calls  [component]
├── no eligible seat / none fit / partial search → clear state [component]
└── return without destination rest → join boundary stretches  [unit + device]

Saved outing
├── create → restart → read → edit → read                      [database + device]
├── dropped response → retry → exactly one record              [integration]
├── concurrent revision → conflict, no lost update             [integration]
├── offline delete → reconnect → no resurrection               [integration]
├── delayed original insert after delete → marker blocks it    [integration]
├── outing with feedback deleted → child rows removed          [database]
└── identity lost/changed → no cross-identity replay            [integration]

Ownership and abuse controls
├── user B guesses user A's IDs → no read/update/delete        [database]
├── feedback points to user A's outing → foreign-key denial    [database]
└── invalid token, oversize input, rate limit → bounded error  [backend]

Mobile journey
├── location denied → named endpoints still usable             [iOS + Android]
├── map unavailable → list journey complete                    [iOS + Android]
├── VoiceOver/TalkBack + large text → all controls reachable   [device]
├── reached vs rested + background/restart → state preserved   [device]
└── installed preview → icon/splash + live fetch + cloud save   [device]
```

Use `tests/plannerInteraction.test.tsx` for reducer/view integration and an isolated test database for ownership tests. Manual installed-device tests remain necessary for native permissions, map credentials, screen-reader focus, and branding. Add a small automated device journey if the team already has a working mobile test runner; do not spend the core schedule building a new test platform.

### User-visible failure behavior

| Failure | What the person sees | Recovery |
|---|---|---|
| No seat data | “No suitable mapped seating found in this search.” Distinguish it from a failed download. | Pick a closer destination, review requirements, or retry discovery. |
| No matching evaluated route | Both cards retain their real metrics and explain the unmet preference. | Change destination or explicitly choose another preference; no silent relaxation. |
| Discovery unavailable | Old catalog with its date, or an empty unavailable state. | Retry; saved plans remain readable. |
| Candidate timeout | Completed direct route and “Alternative search incomplete.” | Retry on demand; no fabricated second route. |
| No routable endpoint | The selected point cannot connect within the supported tolerance. | Choose a named approach point; do not silently move the endpoint. |
| Save fails | “Saved on this phone” after a successful local transaction. | Retry cloud save; never show a cloud checkmark prematurely. |
| Local storage fails | “Couldn’t save on this phone”; draft remains in memory while possible. | Free storage or retry; do not claim durable storage. |
| Return unavailable | Outward route retained, return marked unresolved. | Retry or record a separate arrangement. |
| Snapshot stale/changed | Original plan with its date and a separate refreshed comparison. | Review and explicitly replace the saved version. |
| Permission denied/map failed | Usable named-place selection and ordered steps. | Optional settings guidance; no mandatory permission loop. |
| Rate limited | Clear wait time and preserved draft. | Retry after the server’s allowed interval. |

### Performance checks

Measure on both physical platforms. Preference changes and exclusion previews should update without a network round trip and target under 100 ms of local computation for the bounded dataset. This is a measurement target, not a promise about the current starter. Avoid rerendering all map markers for every text-input keystroke; memoize the normalized marker set and render only the selected route prominently.

For a comparison, show loading feedback immediately and preserve completed results by the 25-second server deadline. Track cold versus warm source-cache timings and provider call count. Verify at most five outward routing calls, one return call when requested, at most two concurrent candidate calls, and no request per marker. Failures must not inflate call counts through nested retries.

Limit saved-list pages to 20 records and load full geometry only for the selected outing. Bound snapshots to 512 KB and 10,000 coordinates; reject oversize responses explicitly. Keep unsimplified geometry for analysis and simplify a separate rendering copy if profiling shows a need. Use parameterized queries and indexed owner lookups rather than fetching everyone’s records and filtering in JavaScript.

## 12. Adversarial review and fixes

This review challenged the product’s claims, data assumptions, architecture, failure behavior, and implementation procedures. An independent same-model reviewer examined the early route/UI specification, then reviewed the completed backend, state, database, and testing sections. This was not a cross-model review. The findings below describe fixes made to this plan; they do not establish that the implementation passes the corresponding tests.

| ID / priority | Adversarial challenge | Specification fix | Verification requirement |
|---|---|---|---|
| A1 / high | An OSM edit is presented as a physical inspection. | Separate edit, recorded check, recorded survey, and download dates; remove “inspected” from the product claim. | Date fixtures and copy review. |
| A2 / high | A bench across a wall splits a walking segment. | Proximity only selects candidates; require a routed waypoint, bounded snap, and visible unconfirmed approach. | Nearby-only and excessive-snap cases; no accessibility claim. |
| A3 / high | A popular landmark or roof is mistaken for a seat. | Seat eligibility is independent of destination role; require explicit seating evidence. | Artwork/café/shelter fixtures. |
| A4 / high | A missing required backrest silently behaves like “yes.” | Three-state values and requirement-aware exclusion join adjoining stretches. | Unknown-backrest arithmetic case. |
| A5 / high | Both directions fit separately, but the round trip does not. | Join stretches across a destination with no eligible rest. | The 530 m boundary example. |
| A6 / high | Reaching an unusable seat resets the guide’s rest distance. | Separate reached/rested state; include prior walking since the last confirmed rest. | 240 + 270 = 510 m guide scenario. |
| A7 / medium | Replacing a waypoint is advertised as avoiding a closed path. | Rename to “Find different planned stops”; physical avoidance is deferred. | No bypass promise in UI or help text. |
| A8 / high | A venue/building center is treated as its entrance. | Separate display and routing coordinates; no implicit area-center route point; explicit alternative approach selection. | Routable named-endpoint feasibility gate. |
| A9 / medium | The search tries arbitrary nearby seats and is impossible to reproduce. | Cap and stratify candidates, define ranking/pair objective, and disclose heuristic limits. | Stable results from permuted input fixtures; request-budget test. |
| A10 / high | Empty or rounded data yields a reassuring zero/within-limit result. | Validate nonempty finite arrays, reject zero routes, compare unrounded values. | Invalid-data and 300.4 m tests. |
| A11 / high | A fresh cache download hides stale physical information. | Cache age is independent of source evidence; current availability remains unconfirmed. | Fresh-download/old-source fixture. |
| A12 / high | Anonymous users can read someone else’s notes or attach feedback to their outing. | Owner RLS, same-owner composite foreign key, server-derived identity. | Two-identity direct database tests. |
| A13 / medium | Retried saves duplicate data, overwrite edits, or revive deletions. | Stable operation IDs, expected revisions, sequential queue, pending-delete markers. | Lost-response, conflict, and offline-delete tests. |
| A14 / medium | Public API dependence fails during the demonstration. | Shared cache, explicit failure states, bounded deadlines and quotas; label fixture fallback. | Live feasibility check and forced-outage rehearsal. |
| A15 / high | A wheelchair switch or step counter implies proven mobility suitability. | Defer these modes until their distinct requirements are validated; no inferred health limit. | Feature-scope and wording review. |
| A16 / medium | A polished map satisfies the demo while excluding screen-reader users. | Equivalent ordered controls, focus testing, large-text layout, map-hidden task. | VoiceOver and TalkBack device journeys. |
| A17 / high | A minimum-improvement filter hides the only route within the preference. | A transition from unmet to met preference always qualifies as useful. | 310 m → 290 m at a 300 m preference. |
| A18 / medium | Deleting an outing leaves feedback behind or conflicts with its foreign key. | Deletion RPC removes feedback transactionally; physical purge has a cascade; exclusions remain independent. | Delete an outing containing feedback. |
| A19 / medium | Account-wide reset races with queued saves. | Defer bulk reset instead of adding a partial deletion protocol; retain individual deletion. | No bulk-reset UI in this release. |
| A20 / medium | Endpoint fallback requires hidden routing probes. | Offer unverified point choices; route only on explicit comparison. | Request budget unchanged after failed endpoint selection. |
| A21 / high | A new session displays the previous owner’s in-memory records. | Owner-scoped query keys and explicit cancellation/cache clearing on identity change. | Identity-switch component/integration test. |
| A22 / medium | An original insert arrives after its retry succeeded and the outing was deleted. | Retain a scrubbed server deletion marker at the stable UUID; creation never upserts; serialize dependent mutations. | Timeout insert A, complete retry B, delete, then deliver A; no restored outing or feedback. |

Architecture review addressed source boundaries, provider dependence, identity, and snapshot ownership. Code-quality review concentrated on shared calculations, runtime validation, and explicit state transitions. Test review maps numerical, failure, database, and device paths above; all implementation coverage remains pending. Performance review bounds candidate work, requests, payloads, and saved-list reads. Deferred work is recorded in §9 rather than added to the core by implication.

The remaining feasibility questions require real implementation evidence: regional seat/attribute coverage, routable endpoints, authenticated ORS behavior, native map builds, and installed-device usability. These are acceptance gates in §10. No plan review can resolve them by adding more confident wording.

For this document, relative links and section anchors were checked, and the example stretch helper passed 11 arithmetic/invalid-input assertions after removing its TypeScript annotations. The four proposed text/background combinations measured approximately 13.77:1, 6.58:1, 6.35:1, and 6.34:1 contrast. These checks validate the written examples and palette choices; they are not TypeScript compilation, database verification, or accessibility testing of an implemented app.

## 13. Course requirements and completion evidence

| Requirement | Planned evidence |
|---|---|
| React Native with Expo, TypeScript, TSX | Existing starter retained; typed domain modules and modular TSX screens. |
| Navigation beyond one stack or tab | Root stack, nested tab stacks, shared details, and meaningful save/feedback modals. |
| Complex layout | Responsive nested Flexbox cards, map/list composition, ribbon, fixed/scrolling actions, keyboard-aware modal forms. |
| React state and one-way flow | Reducer-driven selections, derived route view model, prop/action components, remote query state. |
| Multiple additional third-party libraries | Maps, SVG, Turf, TanStack Query, and Zod each support a demonstrated feature. |
| External asynchronous API | Real Overpass/ORS responses update destinations, geometry, distance, and comparison. |
| Supabase reads and writes | Persist, restart, fetch, edit, and retrieve a private outing; record optional feedback. |
| iOS and Android | Installed builds complete the same journey, including denied location and unavailable data. |
| Thoughtful design | Consistent tokens, clear route tradeoffs, a manipulable ribbon, and destination roles that preserve the rest model. |
| Accessibility | VoiceOver/TalkBack task completion, scalable text, sufficient contrast, non-map alternatives, reduced motion. |
| Splash and icon | Original artwork verified in cold-launched preview builds. |

The first release is complete when a new user can choose downloaded places, compare real routes, understand the assumptions, include a return arrangement, save and retrieve the outing, and recover from one unavailable-data state without entering geographic records or supplying credentials. A landmark-rich map alone does not meet that definition.
