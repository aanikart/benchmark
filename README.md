# Benchmark

Benchmark is a cross-platform walking planner concept that compares a direct
walk with routes that include mapped places to rest. This repository brings
together the project brief, product planning notes, and an Expo/React Native
starter for the app.

## Repository contents

- [`docs/`](docs/) contains the final-project requirements brief.
- [`notes/proposals/01-benchmark.md`](notes/proposals/01-benchmark.md) presents
  the selected direction; the folder also contains alternatives, experience
  design, a build guide, and supporting illustrations.
- [`notes/project-plans/10-benchmark-api-first-plan.md`](notes/project-plans/10-benchmark-api-first-plan.md)
  describes the APIs, route comparison, app architecture, and delivery plan.
- [`mobile-app/`](mobile-app/) is the Expo SDK 58 and TypeScript application
  starter.

The planning documents describe the intended product. The current app remains
an early starter screen and does not yet implement route planning.

## Run the mobile app

Use Node.js 22.23.3 with npm. From the app directory, install dependencies and
start Expo:

```sh
cd mobile-app
npm ci
npm start
```

Open the QR code with an SDK 58-compatible Expo Go app. The app README covers
development builds and the Team 18 EAS configuration.
