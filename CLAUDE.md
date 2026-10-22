# CLAUDE.md

Guidance for working in this repository.

## Project

web-watcher fetches a web page, lets AI propose what on it can be tracked (price, availability,
counts, text), and then checks the chosen values on a schedule and reports changes. It is Karel's
personal learning project for **Docker and MongoDB**: the point is to meet real container and
database problems on a small, real service, not to ship fast. Karel writes the code; Claude
explains, reviews, points at the next step and writes boilerplate or fixes only when asked.

Phase 1 (data model and API) is done, phase 2 (services that write on their own) is in progress:
`fetcher` exists, `worker` and `notifier` are empty entry files. Later phases: Mongo replica set with
transactions and change streams, production-shaped Docker images and networks, backups and metrics.

Every design decision goes to `docs/decisions.md` as one dated entry with the reason and, where
measured, the numbers. Read it before proposing a change to the data model.

## Layout

npm workspaces monorepo, TypeScript ESM (`NodeNext`, `strict`), project references built with
`tsc --build`. Each workspace imports `@web-watcher/shared` through its `dist`, so after a change
in `packages/shared` run `npm run build` (or keep `npx tsc --build --watch` running) before the
editor or another service sees it.

- `packages/shared`: types, Mongo connection and one module per collection (see its `CLAUDE.md`).
- `services/api`: HTTP API over the collections; never does slow work (no fetching, no AI calls).
- `services/fetcher`: downloads pages; the only service meant to reach the internet.
- `services/worker`: claims due trackers, fetches through `fetcher`, extracts values, writes
  observations and events (planned).
- `services/notifier`: follows a change stream on `events`, sends Telegram messages (planned).
- `scripts/`: `ensure-indexes` (collections and indexes, run at deploy time) and
  `seed-observations` (synthetic data for query measurements). Own `tsconfig`, run with `tsx`.
- `test-site/`: static product page served by nginx in Compose, the page used for all manual tests.
- `compose.yaml`: `mongo` (host port **27018**, because a Homebrew `mongod` for work owns 27017),
  `api` (3000), `fetcher` (no published port), `test-site` (8080).

## Conventions

The Incinity conventions apply (TypeScript style, MongoDB modeling): native driver, no ODM, one
module per collection owning its type, indexes and read/write functions, no `any`, no non-null
assertions, optional fields absent rather than `null`, TypeBox only on the HTTP boundary.

- Services are split into `main.ts` (env, connections, listen, SIGINT/SIGTERM shutdown), `app.ts`
  (`buildApp`, registers plugins) and `routes/<resource>.ts` (one Fastify plugin per resource,
  `withTypeProvider<TypeBoxTypeProvider>()`, schemas as module constants).
- Error responses are `{ message }` with the status code; 400 invalid input, 404 unknown id,
  413/415/502/504 for a page that is too large, not HTML, unreachable or slow. Check the id with
  `ObjectId.isValid` before touching the database.
- Config is read from `process.env` in `main.ts` only; a missing environment value throws at
  startup, tuning values have defaults. No `.env` loader, no schema for config.
- Indexes are created by `npm run ensure-indexes`, never by a service at startup; a changed index
  is dropped by hand first, the script does not drop anything.
- `@fastify/type-provider-typebox` stays on `^5` with `@sinclair/typebox` `^0.34`: v6 depends on
  the renamed `typebox` package and silently types every schema field as `string | undefined`.

## Running

```bash
npm install
docker compose up -d --build
MONGODB_URI=mongodb://localhost:27018/web-watcher npm run ensure-indexes
```

After any code change the service image must be rebuilt (`docker compose up -d --build <service>`);
a running container keeps the old code. `npm run check` (build + lint) must pass before a commit.
Host-side commands use port 27018; inside Compose the services use `mongo:27017` and
`http://fetcher:3001`. From the API container the test page is `http://test-site/`, from the Mac
`http://localhost:8080/`.

## Git and execution

Karel keeps control: no commits, pushes or branches unless he asks, and nothing is run (build,
tests, Docker, scripts, dev servers) by Claude; commands go into a `bash` block for him to run.
Reading files and read-only inspection (including `docker compose ps`, `logs`, `mongosh` queries)
is fine.
