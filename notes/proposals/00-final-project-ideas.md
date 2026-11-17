# Final project ideas

Seven focused React Native projects for CS 147L, revised November 5, 2026. Each proposal now has its own page, with the user journey, implementation choices, scope, and acceptance checks. Idea filenames are numbered from most to least promising for this course project, based on the proposals’ immediate value, scope, and delivery risks. This is a planning judgment, not a measure of validated user demand. The [shared build guide](08-project-build-guide.md) covers course requirements and common engineering decisions; the [name review](09-project-name-review.md) explains the new names and preliminary availability checks. Names now use familiar words that can be spoken and spelled without unpacking an invented compound.

**The strongest overall idea is [Benchmark](01-benchmark.md): a walking planner that compares routes around inspected places to rest.** It combines a useful first-day decision with a clear visual interaction and enough engineering depth for the course. Its scope can stay local, and its core result can be checked against real paths. The recommendation depends on being able to inspect that small area; the decision test below makes that condition explicit.

These are alternatives, each intended to become a complete app. The recommendation assumes two to four teammates using coding agents, with roughly one to two weeks of concentrated work within the course calendar. Build estimates count active human team-hours spent designing, reviewing, testing, and preparing delivery. They include revision of generated code; they do not measure the speed of a particular model.

![Benchmark is the recommended overall project. Choose by the work you want to improve: a walking record leads to Walk by Walk or Days on Foot; a walking ritual leads to Kind Tempo; a local outing leads to Benchmark; home preparation leads to Evening Ready; exercise review leads to Move in View; an appointment account leads to Bring a Note.](assets/project-ideas/choose-a-project.svg)

## Compare the proposals

The first effort range covers a focused complete version. The second is the **total** for a refined version, including the first version. These are planning judgments, with no implication about grades or health outcomes.

| Proposal | What a person gains on day one | Interaction worth developing | Human hours: first / refined total |
|---|---|---|---:|
| **[Benchmark](01-benchmark.md) — recommended** | A local route choice with inspected rest opportunities and clear unknowns. | A sequence of walking distances and rest stops changes with the route. | 44–64 / 60–84 |
| [Evening Ready](02-evening-ready.md) | One chosen preparation for a familiar evening path at home. | A room segment changes after the person confirms a task. | 32–46 / 46–64 |
| [Kind Tempo](03-kind-tempo.md) | An optional, comfortable rhythm for a short walk. | A saved session adds a leaf without rewarding speed or streaks. | 30–44 / 44–60 |
| [Walk by Walk](04-walk-by-walk.md) | A familiar walk recorded with estimated steps and personal notes. | Two comparable walks align, with recording conditions visible. | 36–52 / 50–72 |
| [Bring a Note](05-bring-a-note.md) | A private concern record and an editable discussion card. | Each automatically assembled sentence reveals its source. | 34–50 / 48–68 |
| [Days on Foot](06-days-on-foot.md) | A diary entry connecting a walk with how the day felt. | “Why these days?” explains a comparison through its source fields. | 30–44 / 44–62 |
| [Move in View](07-move-in-view.md) | A correctable exercise record, with manual entry available immediately. | Select a candidate repetition and inspect the movement behind it. | 50–70 / 70–100 |

## Why Benchmark is the strongest overall idea

For this assignment, I would prioritize usefulness and the quality of the complete experience, then technical depth and delivery risk. Benchmark has the best balance across those criteria. This is a judgment about the proposed project, not a claim that user demand or route quality has already been validated.

| Selection criterion | Why Benchmark leads |
|---|---|
| A concrete reason to use it | Before leaving, a person can compare how far they would need to walk between planned rests. The answer is useful with an empty account. |
| An interaction that explains the decision | The rest ribbon makes the extra distance and the longest walking segment visible together. Changing a preference can change which route qualifies—or show that neither does. |
| Technical work that serves the purpose | Routing responses supply actual geometry and distances; Supabase holds inspection records, preferences, and saved plans. The API, database, accessible list, and visual comparison all contribute to the same task. |
| A manageable way to check the result | A team can walk a small pilot area and compare the displayed route with the actual path. This bounds the verification work, although it cannot guarantee a seat will remain available. |
| Room for meaningful refinement | Testing can reveal whether people understand the distance tradeoff and unknowns. The team can then improve the route comparison, reading order, and saved-plan review without adding another product. |

The other proposals each give up something important. **Evening Ready** is easier to deliver, but must show that a dedicated app improves on an ordinary reminder. **Kind Tempo** depends heavily on whether people enjoy repeating its sound-based ritual. **Move in View** puts much more of the schedule into camera analysis and video handling. **Walk by Walk** faces sensor uncertainty; **Days on Foot** needs repeated diary use to demonstrate its longer-term value. **Bring a Note** has a useful reporting task, with less visual scope and a substantial burden to keep sensitive summaries faithful.

Bench discovery itself is already served by products such as [BenchFinder](https://apps.apple.com/us/app/benchfinder-find-your-bench/id6759806474) and [Bänkle](https://apps.apple.com/us/app/b%C3%A4nkle-bench-rest-finder/id6780661807); Bänkle also advertises walking routes and seating filters. The proposed distinction to test is **an inspected route comparison against a chosen maximum distance between rests, including the return arrangement**. The recommendation rests on executing that decision well, not on claiming to have invented bench maps.

**Commit after a small feasibility test.** Within the first two active days, fetch a real route, display the comparison on both platforms, and inspect the paths and approaches to the pilot seats. Use two destinations and two route choices per destination. Ask intended users to explain which option meets a sample rest preference and what remains unknown. If the information is misleading or the comparison adds little beyond a map, revise it before expanding. If inspection or routing access is unavailable, select **Evening Ready** as the fallback.

## Adversarial review

The same questions were applied to all seven proposals: does it help with an empty account; is its value distinctive; can the difficult feature work on both platforms; do its conclusions stay within the evidence; and does it remain useful when data are missing or an operation fails? “Strong” below means the proposed scope has a credible path to delivery. None of these apps has been built or validated by this document review.

| Proposal | Value and distinctiveness | Strongest objection | Resolution in the proposal | Evidence needed before commitment |
|---|---|---|---|---|
| **Walk by Walk** | Useful immediately; moderately distinctive. Its value depends on understandable comparisons. | A polished pedometer display may imply knowledge of balance or walking quality. | Keep aggregate estimates, duration, phone placement, and notes together. Omit estimates when recording fails; make no health score. | In about four focused hours, record on both phones and compare counts with manual observations. Choose a diary-only scope consciously if the sensor adds little. |
| **Kind Tempo** | Immediate value and strong sensory potential if people enjoy repeating it. | A beat may distract or pressure the person; unreliable playback spoils the central experience. | Preview tempo while seated, allow silence and early stopping, pause credited time with audio, and use bundled tracks. | In about two hours, test a complete track and interruptions on both phones. Then ask intended users whether they would repeat the activity. |
| **Move in View** | Distinctive, with substantial technical depth; the least predictable delivery. | Body-point graphics can make incorrect counts appear authoritative, while video handling adds hidden work. | Limit the app to one known movement, expose uncertain intervals, preserve corrections, and clean up temporary video after failures as well as success. | In about six hours, process newly recorded clips from both phones through a deployed worker. If that fails, reconsider the concept before building the replay interface. |
| **Days on Foot** | A credible diary; differentiated only if comparisons are easier to understand than ordinary notes. | Sparse entries and several changing conditions can produce persuasive but unsupported patterns. | Explain selection rules, retain missing fields, invalidate changed comparisons, and keep prediction outside the required scope. | Save, reopen, edit, and compare real entries. Have two intended users explain the comparison without coaching; use several days of diary use to assess burden. |
| **Benchmark** | Strong immediate value and a clear decision to demonstrate. | A mapped seat can be inaccessible or unavailable; an outward route can leave the return unresolved. | Inspect the actual paths, show the longest rest interval including endpoints, reject nonmatching routes, and require an explicit return arrangement. | In four to six hours, fetch and display real routes, save one, and inspect the pilot area. Without field access, choose Evening Ready or describe a much narrower map-exploration project. |
| **Evening Ready** | Practical first-day value with manageable integration risk. | A glowing illustration could imply that the home was automatically checked. A checklist may also add work without helping. | Label completions as user reports, keep sunset separate from indoor light, and reset evening checks without discarding the reusable path. | In three to four hours, fetch sunset and complete a saved task on both platforms. Observe whether a person finishes a useful preparation with less confusion than before. |
| **Bring a Note** | Useful immediately; its distinction is faithful, selective reporting. | A polished card could imply a clinical assessment or retain deleted concerns in copied text. | Use traceable templates, separate personal wording from education, block stale exports, and remove dependent in-app copies after deletion. | In three to four hours, exercise the entry-to-summary flow with edits and deletion. Verify that users can identify the source of each sentence. |

These tests can justify proceeding, narrowing the scope, or selecting another idea. A two-hour audio check cannot prove that a walking ritual is beneficial, just as a successful route request cannot establish pedestrian access. The proposal pages distinguish implementation checks from the observations needed to judge usefulness.

## What changed after review

The original numerical ratings suggested more precision than the evidence supports, so the comparison now states selection conditions. The technical plans retain their useful safeguards and add several missing connections between them:

- **Weather has a source and a time.** Walk by Walk and Days on Foot distinguish forecasts from retrospective estimates. An outdoor forecast cannot describe a room, and today’s response cannot silently fill yesterday’s entry.
- **Interrupted work has a defined outcome.** Kind Tempo pauses credited time with playback. Move in View links manual and analyzed results to one session and includes cleanup after a crash or abandoned upload.
- **Route arithmetic includes the whole decision.** Benchmark counts the first and last walking segments, treats unavailable stops as unavailable, and makes return arrangements part of saving a plan.
- **Completion and deletion stay meaningful over time.** Evening Ready separates recurring paths from tonight’s checks. Bring a Note prevents sharing an out-of-date summary until it is reviewed; both journal concepts remove dependent saved text when its source is deleted.
- **Accessibility reaches the main interaction.** Each graphic has a text equivalent. The eventual apps need usable alternatives to maps, scrubbing, dragging, sound, and color, verified with VoiceOver and TalkBack.

## Choose a scope the team can finish

Allow at least one-third of human effort for trying the working app and directing revisions. A first complete journey should exist within roughly three to five active days, leaving the final two or three days for device testing and delivery. Agent execution can overlap, but field inspections, build credentials, and participant availability remain calendar constraints. A team available only for a few evening hours should reduce scope or choose a smaller Kind Tempo or Evening Ready.

Follow the [assignment PDF](../../docs/final-project-instruction.pdf): proposal on November 5; Sprint 1 before lecture on November 17 for CS 147L-only groups or November 19 for groups also taking CS 147; final submission on December 6 at 9 p.m. The assignment requires a working feature per member and development builds on every member’s device by Sprint 1. The [build guide](08-project-build-guide.md) carries the full technical and submission checklist.

Before selecting, verify that the idea does not resemble any teammate’s previous creative project. Agree on AI use, give each teammate a substantial coding contribution reflected in the commit history, and choose one person to coordinate integration. The working names are ready for these proposal documents; public release still requires the remaining checks in the [name review](09-project-name-review.md).
