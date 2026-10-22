# services/api

The HTTP API over the collections. It reads and writes Mongo and calls `fetcher`; it never does
slow work itself (no page download, no AI call), so every request stays fast and the worker owns
everything that can fail or take minutes.

## Layout

- `main.ts`: `MONGODB_URI` and `FETCHER_URL` required, `API_PORT` default 3000, connects, builds
  the app, listens on `0.0.0.0`, closes app then client on SIGINT/SIGTERM.
- `app.ts`: `buildApp(db, fetcherUrl)`, `/health`, registers the route plugins.
- `routes/pages.ts`: `POST /pages` (fetch through `fetcher`, find-or-create the page, insert a
  snapshot; 201 with `snapshotCreated: true`, 200 with `false` when the content hash already
  exists), `GET /pages/:id`.
- `routes/trackers.ts`: `POST /trackers`, `GET /trackers/:id`, `GET /pages/:id/trackers`,
  `GET /trackers/:id/history?from&to` (default last 7 days, `from` after `to` is 400).
- `routes/events.ts`: `GET /trackers/:id/events?limit`, `GET /events?pending&limit`.

## Rules

- One plugin per resource, `FastifyPluginAsync<{ db: Db; ... }>`, options passed from `app.ts`.
  Schemas are module constants; `idParams` is repeated per file until it is needed a third time.
- Handler order: validate the id (`ObjectId.isValid` → 400), load the parent (404), then act.
  Return `reply.code(...).send({message})` from every error branch; let unexpected errors throw so
  Fastify answers 500 and logs them. No `try/catch` around reads; the only caught Mongo error is
  the duplicate key (11000) on snapshot insert, which is a legitimate "unchanged" answer.
- Fetcher errors (400/413/415/502/504) are passed through with their status and message; an
  unreachable fetcher is 502 `fetcher unavailable`.
- Responses are the stored documents as they are; HTML is never returned.
- `Type.Integer({minimum, maximum})`, `Type.Boolean()` and `format: "date-time"` on query
  parameters do the validation and the string-to-type conversion; no manual parsing in handlers.

## Testing by hand

Rebuild the image first (`docker compose up -d --build api`), then HTTPie against `:3000`; ids come
from `mongosh` on the `mongo` container or from earlier responses. `http POST :3000/pages
url=http://test-site/` is the smoke test. A 404 with `"error": "Not Found"` in the body is Fastify
not knowing the route (old image), one with only `{message}` is the handler.
