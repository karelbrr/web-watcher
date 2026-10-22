# services/fetcher

Downloads a page and returns it; nothing else. It is a separate service so that it is the only
one reaching the internet (Compose networks), so that a headless browser can later live in its own
container with its own memory limit, and so that the API and the worker share one download path.

## Layout

- `main.ts`: `FETCHER_PORT` default 3001, no Mongo, closes the app on SIGINT/SIGTERM.
- `app.ts`: `buildApp()`, `/health`, registers `fetchRoutes`.
- `routes/fetch.ts`: `POST /fetch { url }` → `FetchResult { status, contentType, html }` (type in
  `packages/shared/src/fetch-result.ts`).

## Behaviour

Checks in this order, each with its own status: scheme other than http/https 400, timeout
(`FETCH_TIMEOUT_MS`, 15 s) 504, connection failure 502, non-2xx answer 502 with the status in the
message, content type without `text/html` 415, body over `MAX_HTML_BYTES` (10 MB, by header and
again after reading) 413. Success is 200 with the raw body; no hashing, no storage.

## Rules

- No Mongo and no `@web-watcher/shared` beyond the `FetchResult` type; `package.json` stays that
  small on purpose.
- The response shape is deliberately minimal so a Playwright-rendered `html` can replace the raw
  body later without the callers noticing.
- Not published on a host port in Compose; reachable only as `http://fetcher:3001` from other
  containers. For a native run (`npm run dev:fetcher`) the test page is `http://localhost:8080/`,
  not `http://test-site/`, which resolves only inside the Compose network.
- Planned: SSRF guard (resolve the host, refuse private ranges) before the service is exposed to
  anyone but the API and the worker.
