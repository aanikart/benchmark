## Role

You are an expert cross-platform mobile apps architect, specializing in modern and modular React Native applications.

You prioritize simple and intuitive UI/UX design, clean idea concepts, and easy to use app features. Your apps serve a meaningful purpose and can be used without any external setup or data collection.

## Task

You are to carefully and systematically rethink the design of the app and ideas for UI/UX design for the proposal in `notes/proposals/01-benchmark.md`. It currently requires the user to collect data about benches in a particular area, which is unfeasible and impractical.

Ultrathink on how to keep the primary idea of Benchmark: a walking planner that compares routes around inspected places to rest, but using various APIs, backends, and databases to coordinate navigation and app usage.

You must leverage your rich background knowledge and reasoning capabilities to choose ideas that are innovative, feasible, and astounding in depth and creativity.

Based on some of my ideas below, creatively and thoughtfully brainstorm on how to significantly enhance the quality and interactivity of the app. The goal is for you to produce the best possible app based on the Benchmark idea in one shot. You must be able to generate highly detailed and specific instructions to construct an app that is useful, unique, novel, and fun to interact with.

Here are some alternatives to the current plan for data collection:

* Benches and other rest spots: OpenStreetMap, through the Overpass API. It's free and needs no key. You ask for amenity=bench inside a bounding box around your campus, and you can add amenity=shelter and leisure=picnic_table. Many benches have tags like backrest=yes/no and material. Some have a check_date showing when someone last confirmed the bench. If you request out meta, you also get the date the entry was last edited. That gives you the bench card's "when it was checked" for free. Be honest about it in the UI: say "last updated in OpenStreetMap on March 2025," not "inspected."

* Walking routes: OpenRouteService, using the foot-walking profile. It's free with a key and can return elevation along the route. For the direct route, you request start → destination. For the alternative, you request start → bench → destination, using the bench as a waypoint. GraphHopper and Valhalla work too.

* Splitting a route into segments: Turf.js. Use it to find which benches sit within about 15 m of the route line. Then measure each stretch: start to the first bench, bench to bench, and the last bench to the destination. The longest stretch is the number you compare against the person's limit. A bench missing important tags (say, no backrest info) counts as "unknown" and doesn't split a segment. That matches the original spec's rule. Turf.js also counts toward the third-party library requirement.

* Weather (optional): Open-Meteo. It's free and needs no key. Heat or rain is a fair reason to suggest more rest stops.

* Supabase stores the parts that have to come from users anyway: saved outings and post-walk feedback ("Was this manageable? Did the bench match its description?"). That's not you entering data. It's the app collecting it, and it covers the database requirement.
Gait and mobility. This is doable, but go carefully:

* Easiest: the Pedometer in expo-sensors works on both iOS and Android with no extra hardware. You could measure a short walk to suggest a starting "max distance between rests."

* More ambitious: Apple HealthKit (through react-native-health) offers walking speed, step length and "walking steadiness." Android's version is Health Connect. You have a development build, so both are possible. But you'd have to build two native integrations to meet the cross-platform rule, and they add permissions work. I'd make this a stretch goal.

* Wheelchair users: OpenRouteService has a wheelchair profile that accounts for kerbs, incline and surface type. That would be a good way to widen the app's audience, and it's still all API data.

Thoughtfully and systematically incorporate Occam's Razor design principles to build using simplest functional design and implementations.

Use adversarial review to check and verify your plan and writing in general. Fix all issues carefully and systematically.

## Key React Native features and techniques

The output instruction should systematically describe the building of a modern and modular **React Native** app with Expo, using TypeScript and TSX**, and make it interactive through **React state and one-way data flow**.  Here are key React Native features and techniques should be demonstrated in this app.

* Navigation: App features multiple screens, each serving a meaningful purpose within the app, and some kind of complex navigation, i.e., more than just a single Stack or Tab navigator. (Navigation will be covered in Lecture 7b.)
* Layout: Screens have layouts that are complex, comprising multiplied nested Views with a variety of proportions, flex directions, etc.
* Interactivity: App includes multiple interactive features that change the UI in response to user-triggered events.
* Third-party libraries: App makes use of multiple third-party libraries (besides basic libraries and libraries already installed in the starter code, such as axios, supabase, expo-router, react-navigation, etc.).
* Async: App makes fetch requests to at least one external API (not including Supabase) and uses the response to update the UI.
* Database: App both fetches from and updates data in a database (Supabase).
* Cross-platform: App should support both iOS and Android and look good across different mobile device sizes.
* Thoughtful design: Pages demonstrate intentional use of text hierarchy, color, spacing, and typography.
* Accessibility: Pages are perceivable, operable, and understandable to a user of a screen reader. (Accessibility will be covered in Lecture 8b.)
* Splash screen and app icon: Your app should have a custom splash screen and app icon.

## Output Requirements

Your output must be a structured Markdown document in the "notes/proposals" folder containing a clear and specific plan. Also add adversarial review to check and verify any design and implementation procedures, as well as fixes for them.

Your output must avoid common LLM output styling and characteristics:
- Staccato drumbeat sentences: short sentences
- Excessive aphorism
- The "it is not X, it is Y" correction reflex that is highly correlated with LLM outputs. This antithesis pattern appears throughout at high density.
- Recycled pivot phrases. A human author usually notices near-verbatim self-repetition ten lines apart; models reaching for a favorite transition do not.
    - "Confidence tells the same story from a different angle"
    - "The concurrency tier tells the same story from a slightly different angle"
    - "What looks like an architecture effect is noise"
- Intensifier tics: too many repeated adverbs such as: "Actually" or "exactly".
- Anthropomorphic phrasing throughout.
- Many groomed triads: examples:
    - "Real, sharply structured, and immune to the standard fixes."
    - "Never the oracle, never the operator, and never which arm of the pair."
- The suspicious absences of em-dashes "--", and zero instances of the classic AI lexicon (delve, leverage, robust, comprehensive, landscape, underscore). Most human ML writers use a dash or the word "robust" at least once.
