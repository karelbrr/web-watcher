# web-watcher

A service that fetches a web page, lets AI propose what on it can be tracked, and then watches the
chosen values and reports changes. It is a learning project for Docker and MongoDB: every service
runs in Compose, the data model is built on the native MongoDB driver, and every design decision is
written down in `docs/decisions.md`.

## Status

Phase 1 (data model and API) is nearly done:

- `pages`, `snapshots` (gzip HTML), `trackers` and `observations` (time series, 90-day TTL) exist
  with their indexes and routes.
- `events` is next; then the `fetcher`, `worker` and `notifier` services, a Mongo replica set and
  production-shaped Docker images.

## Architecture

```text
client (HTTPie, Bruno) ──▶ api ──▶ mongo ◀── worker ──▶ fetcher ──▶ tracked web pages
                                     │          └──▶ AI model
                                     └──▶ notifier ──▶ Telegram
```

- `api` reads and writes Mongo only; it never does slow work (fetching, AI calls).
- `worker` claims due trackers, fetches pages through `fetcher`, extracts values, writes
  observations and events.
- `fetcher` is the only service with internet access.
- `notifier` follows a change stream on `events` and sends Telegram messages.

Shared types and one module per collection live in `packages/shared`; the services are under
`services/`. Only `api` is implemented so far.

## Collections

| Collection     | Holds                                                | Notes                                     |
|----------------|------------------------------------------------------|-------------------------------------------|
| `pages`        | one document per tracked url                         | unique on `url`                           |
| `snapshots`    | fetched HTML per page, gzip `Binary`, content hash   | unique on `pageId` + `contentHash`        |
| `trackers`     | what to watch: selector, kind, interval, condition   | `nextCheckAt` drives the worker           |
| `observations` | one value per check                                  | time series, `trackerId` meta, 90-day TTL |
| `events`       | changes and met conditions (planned)                 |                                           |

## Running locally

Requirements: Node 22+, Docker with Compose (OrbStack or Colima on macOS), HTTPie for testing.

```bash
npm install
docker compose up -d --build
MONGODB_URI=mongodb://localhost:27018/web-watcher npm run ensure-indexes
```

Mongo is published on host port **27018** (27017 is often taken by a local `mongod`); inside the
Compose network the services use `mongo:27017`. The API listens on `http://localhost:3000`, a static
test page on `http://localhost:8080` (reachable from the API container as `http://test-site/`).

After every code change rebuild the service image, otherwise the container keeps running the old
code:

```bash
docker compose up -d --build api
```

To run the API natively against the Compose Mongo:

```bash
MONGODB_URI=mongodb://localhost:27018/web-watcher npm run dev:api
```

## API

| Method | Path                            | Purpose                                                  |
|--------|---------------------------------|----------------------------------------------------------|
| GET    | `/health`                       | liveness                                                 |
| POST   | `/pages` `{ url }`              | fetch the page, store a snapshot; 201 new, 200 unchanged |
| GET    | `/pages/:id`                    | page without HTML                                        |
| GET    | `/pages/:id/trackers`           | trackers of a page                                       |
| POST   | `/trackers`                     | create a tracker: `pageId`, `name`, `kind`, `selector`, `interval`, `condition?` |
| GET    | `/trackers/:id`                 | tracker detail                                           |
| GET    | `/trackers/:id/history?from&to` | observations in a range, default last 7 days             |

Errors answer `{ message }` with 400 (invalid input), 404 (unknown id), or 413/415/502/504 when the
fetched page is too large, not HTML, unreachable or slow.

Example:

```bash
http POST :3000/pages url=http://test-site/
http POST :3000/trackers pageId=<pageId> name="Price" kind=price selector=".price" interval:=3600 condition:='{"type":"below","value":4500}'
http ":3000/trackers/<trackerId>/history"
```

## Scripts

| Script                      | Does                                                          |
|-----------------------------|---------------------------------------------------------------|
| `npm run check`             | TypeScript build and ESLint                                   |
| `npm run ensure-indexes`    | creates collections and indexes; run after every index change |
| `npm run seed-observations` | inserts synthetic observations for the first three trackers   |
| `npm run dev:<service>`     | runs a service with `tsx watch`                               |

Indexes are created by the script at deploy time, never by a service at startup.

## Docs

- `docs/decisions.md`: one entry per design decision, with the reason and, where measured, the
  numbers.
