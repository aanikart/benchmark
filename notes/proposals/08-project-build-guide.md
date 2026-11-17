# Shared build guide

[Proposal comparison](00-final-project-ideas.md) · [Name review](09-project-name-review.md)

This guide applies to all seven proposals. It separates course obligations from suggested implementation choices, so each idea page can concentrate on its own user experience. Requirements below come from the local [assignment PDF](../../docs/final-project-instruction.pdf), pages 2–7. Check later course announcements for distribution details, which the PDF leaves partly undecided.

## Course requirements

| Requirement | Evidence to prepare |
|---|---|
| A new repository in `cs147L-26au`, built on the course starter. | A clean checkout that another person can build using the supplied instructions. |
| Meaningful screens and navigation beyond one stack or tab navigator. | A useful tab group with nested detail screens and a session or review modal. |
| Nested layouts and several interactive features. | A complete task in which choices change the interface, including on a small phone with large text. |
| Multiple additional third-party libraries. | Compare dependencies against the actual starter, then explain each addition’s purpose. Existing Axios, Supabase, Expo Router, or React Navigation dependencies do not count as additions. |
| An external API request, separate from Supabase, that updates the interface. | A real response changing the route, weather, sunset, exercise reference, or education view. |
| Supabase reads and writes. | Create a record, close and reopen the app, retrieve it, edit it, and verify the saved change. |
| iOS and Android support. | Installed builds completing the main journey, including a relevant permission denial or interruption. |
| Thoughtful design and screen-reader accessibility. | VoiceOver and TalkBack completing the task, plus large text and alternatives to visual-only controls. |
| Custom icon and splash screen; standalone installation. | A fresh launch of a preview build showing the actual identity. Expo Go alone is insufficient. |
| Significant code contribution from every teammate. | Clear ownership and meaningful commits that each member can explain. The app must not resemble a member’s prior creative project. |

The proposal includes team details, a build leader, repository link, core vision, key features, wireframes, and a roadmap. Sprint 1 needs one working feature per teammate and a development build on each person’s device. Take notes on teaching-team feedback and address it in Sprint 2. Prepare setup instructions, the demo video, final code, and the installable build; follow subsequent announcements for the exact submission form and distribution method.

The PDF requires environment variables and keys in a privately submitted `.env`, not committed to Git. Include `.env.example` with placeholders and document any server configuration separately. Code running on a phone cannot keep embedded privileged keys secret, even if those values originally came from `.env`. Expo explains that [`EXPO_PUBLIC_` values are readable in a compiled app](https://docs.expo.dev/guides/environment-variables/).

## Common architecture, in plain terms

**React Native** builds phone interfaces using JavaScript or TypeScript. **TypeScript** adds checks on the kinds of values passed through the code. **Expo** provides build tools and access to phone capabilities. An **API** is an interface for requesting data or actions from another system; **HTTP** is the request-and-response protocol used by the external services here.

**Foreground** means the app is open and active; moving to another app or locking the phone may interrupt foreground work. Use the course-compatible Expo version and the starter’s navigation system. A **stack** opens successive screens; **tabs** switch between main areas; a **modal** temporarily opens a focused task such as recording or reviewing a summary. Each proposal describes useful screens rather than adding navigation solely to meet the rubric.

![The phone handles the main task and a recoverable draft. Public context requests return weather, education, or other reference data. Authenticated reads and writes reach owner-protected Supabase records. Privileged operations use a server, with a separate video worker only for Move in View.](assets/project-ideas/shared-data-flow.svg)

Reuse the starter’s authentication flow where possible. Authentication establishes who signed in. **Row-level security** is the database rule that determines which individual records that account may read or change. Use Supabase’s Postgres database for structured records, with owner IDs, stable record IDs, and timestamps. Test access with two accounts, including direct requests that bypass the normal interface. Photos and videos need private Storage buckets and their own access rules. See [Supabase database security](https://supabase.com/docs/guides/database/secure-data) and [Storage bucket access](https://supabase.com/docs/guides/storage/buckets/fundamentals).

Keep a recoverable local draft and an explicit Retry action. Display “Saved on this phone” until a server save succeeds. A stable ID and a database uniqueness rule make a repeated save update the same logical record, preventing duplicates when the network response is lost. A **snapshot** is a saved copy of data at a particular time, and a **timestamp** records that time. A **cache** is a stored copy used to avoid another request; a cache alone does not synchronize edits across devices. Keep the first version to one editing device at a time, or detect conflicting changes before overwriting them.

If durable local history is necessary, [`expo-sqlite`](https://docs.expo.dev/versions/latest/sdk/sqlite/) provides an on-device database. SQLite is not encrypted automatically. SQLCipher adds encryption but requires native configuration and a verified key-management approach. Save only what the product needs and avoid sensitive local history unless the team can manage that extra responsibility.

An **endpoint** is a particular server address for an operation. Keep shared privileged keys behind an authenticated server endpoint, validate its inputs, and limit repeated requests. A **worker** is a separate process for long operations, such as Move in View’s video analysis. Supabase Edge Functions can coordinate a job without taking on all the video decoding and Python computation. **Polling** means asking periodically whether that job has finished; cancellation and late results must obey the saved job state.

## Library choices

The starter repository is absent from this workspace, so these are candidates, not verified compatible additions. Check its dependency versions before installing anything.

| Candidate | Purpose and limitation |
|---|---|
| [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/react-native) | Manages remote loading, cached responses, and retries. Connect it to React Native’s network and app-focus events. It does not provide durable synchronization by itself. |
| [Zod](https://zod.dev/) | Validates incoming data against expected fields and types before the app relies on it. |
| [React Hook Form](https://react-hook-form.com/get-started) | Helps manage form values and errors. Labels, reading order, and accessible error messages still require deliberate design. |
| [React Native SVG](https://github.com/software-mansion/react-native-svg) | Draws scalable shapes and diagrams. **SVG**, or Scalable Vector Graphics, stores paths and text rather than a fixed grid of pixels. |
| [Reanimated](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/) | Supports smooth interface transitions. Verify the supported React Native version; version 4 requires the New Architecture, React Native’s newer native integration system. |

Install only packages that serve an actual feature. The idea pages explain their additional sensor, audio, mapping, parsing, or statistics dependencies. A **native dependency** includes iOS or Android code and generally requires a new development build when its configuration changes.

## Accessibility and presentation

Design the main action for VoiceOver and TalkBack from the beginning. Use descriptive control labels, logical reading order, scalable text, and generous spacing. Aim for roughly 48 logical units for important touch targets. Provide buttons alongside dragging or scrubbing and a useful ordered list alongside a map. A chart should have a sentence or table that communicates the same information. Use the [React Native accessibility APIs](https://reactnative.dev/docs/accessibility.html), then check the behavior on actual devices.

Announce meaningful changes without repeatedly interrupting speech. Let people disable decorative sound, vibration, and motion; reduced-motion mode should preserve the result. Recording and audio flows should require no visual attention while walking. A rest day should not erase progress, and completing a session should acknowledge participation without implying medical improvement.

Each proposal includes an icon and splash direction. Test both in the installed preview or production build, because development launch screens may differ; see [Expo’s branding guide](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/). The SVGs in these documents are explanatory illustrations, with sample data where labeled. They are not screenshots of an implemented app or evidence of a successful experiment.

## What the data can support

Keep measured values, estimates, personal reports, and predictions visibly distinct. A phone’s step estimate cannot establish balance or left-right symmetry. A pose model’s body points do not certify exercise technique. Weather estimates and sunset times describe outdoor context, while a user-confirmed home task records what the person reported.

No suitable, general-purpose public service was established in this proposal review that converts arbitrary cross-platform phone data into a clinically validated personal fall probability. Apple’s permissioned [Walking Steadiness measure](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/applewalkingsteadiness) is a possible later iPhone-only integration, with its own collection requirements. It is neither the shared Android core nor the external HTTP fetch required by the assignment.

None of these apps should ask an at-risk older adult to perform an unsupervised clinical balance test. The [CDC Timed Up and Go instructions](https://www.cdc.gov/steadi/media/pdfs/STEADI-Assessment-TUG-508.pdf), for example, require someone to stay beside the patient. The [STEADI resources](https://www.cdc.gov/steadi/about/index.html) support appropriate educational topics; adapting a few questions does not create a validated clinical screen.

Use consented, comfortable activities to evaluate engineering behavior. Record the conditions and failures of those tests. Synthetic data can demonstrate an empty or long-history interface when labeled, but cannot establish measurement accuracy or predictive usefulness.

## External services and operating costs

The source document reported successful sample requests on November 5, 2026 to Open-Meteo, wger, Sunrise-Sunset, and MedlinePlus. Those reports are retained as prior research, not as tests repeated during this editing pass. Provider documentation for the core services was revisited for this revision. No authenticated routing request, hardware action, or mobile integration was performed here.

| Service | Proposals | Access and unresolved implementation work |
|---|---|---|
| [Open-Meteo](https://open-meteo.com/en/docs) | Walk by Walk, Kind Tempo, Days on Foot | Forecast weather for a selected locality. Follow [current terms](https://open-meteo.com/en/terms), attribution, and noncommercial free-service limits. Preserve units, source type, and timestamps. |
| [wger](https://wger.readthedocs.io/en/latest/api/api.html) | Move in View | Public exercise catalog reads need no authentication. Check a suitable item’s translations, media, and individual license before using it. The catalog does not prescribe an exercise. |
| [openrouteservice / HeiGIT](https://api.heigit.org/) | Benchmark | Requires an account and key. Verify routing against the pilot area before map design. Check current account quotas and any separate basemap plan. |
| [Sunrise-Sunset v2](https://sunrise-sunset.org/api) | Evening Ready | No key required; visible attribution is required. Handle the location’s timezone and absent solar events. |
| [MedlinePlus](https://medlineplus.gov/about/developers/webservices/) | Bring a Note | No registration required. XML responses; no more than 85 requests per minute per IP, with 12–24-hour caching recommended. Send generic topics, never personal notes. |
| [Home Assistant](https://developers.home-assistant.io/docs/api/rest/) | Optional Evening Ready extension | Requires an existing authenticated installation and compatible hardware. No real lamp was tested. |

A starting weather request is:

```text
https://api.open-meteo.com/v1/forecast?latitude=37.4275&longitude=-122.1697&hourly=temperature_2m,precipitation_probability,wind_speed_10m&forecast_days=1&timezone=America%2FLos_Angeles
```

Replace the example locality, select the intended hour, and label the result as a forecast. For older diary entries, consult the [historical-weather documentation](https://open-meteo.com/en/docs/historical-weather-api) rather than attaching a current forecast. Do not compare unlike weather sources silently.

The smaller concepts may fit within free prototype allowances, but check the [current Supabase plan](https://supabase.com/pricing) and service limits during setup. Inactive-project handling, storage, and transfer allowances can affect grading availability. Benchmark may need a paid tile plan; Move in View adds worker compute, video storage, and transfer. Set usage caps after choosing providers. Coding-agent charges are separate, and no specific operating bill is established here.

When a request fails, preserve the draft, explain unavailable or old data, and offer Retry. A labeled demonstration dataset is useful during an outage but does not substitute for the assignment’s real external fetch.

## Build and review sequence

| Phase | Approximate timing | What to produce and verify |
|---|---|---|
| Prove the difficult part | First one or two active days | Install on both platforms, inspect one real API response, and complete the proposal’s feasibility experiment. Compare two plausible approaches before changing frameworks. |
| Complete the useful journey | Roughly days two to five | Start with an empty account, perform the main task, save, reopen, and edit. Make denial, cancellation, and retry understandable. |
| Improve through observation | Remaining time before stabilization | Run at least two small feedback rounds. Compare alternate wording or interaction designs against specific confusion observed in use. |
| Stabilize and deliver | Final two or three days | Test fresh installations, screen readers, ownership rules, and one important failure. Recheck branding, setup instructions, private configuration, and attribution. |

For a two-person team, divide the main interaction and its data/history flow, sharing accessibility and testing. A third person can own comparison or explanation. A fourth needs a coherent contribution such as video processing or deeper route handling. Agree on shared data types and file ownership when assigning bounded work to coding agents, and have a human integration lead decide dependency changes and merge order.

The most useful refinement studies are concrete: for Benchmark, compare map-first and rest-sequence-first route selection; for Evening Ready, compare a room walkthrough with a single illustrated path; for Kind Tempo, compare sound palettes after repeated use. Ask what the person understood and completed, not simply which screen they preferred. Preserve the original app boundaries even if one idea borrows a useful interaction from another.

In the demonstration, show the person’s problem, the main action, the saved result, and a difficult case handled well. Include a change made after feedback. This gives the teaching team evidence of polish and technical depth without relying on a tour of unfinished features.
