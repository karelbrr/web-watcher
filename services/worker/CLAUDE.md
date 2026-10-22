# services/worker

Not implemented yet (`main.ts` is empty). This file records the agreed design so the code follows
it; update it as the worker takes shape.

## Role

The only service that does slow or failing work: it claims due trackers, fetches their pages
through `fetcher`, extracts values with the tracker's selector, writes observations and events,
and later calls the AI model (page analysis into proposed signals, selector repair). It runs in
several instances and must survive being killed anywhere in the middle.

## Loop per tracker

1. Claim: `findOneAndUpdate({nextCheckAt: {$lte: now}, claim: {$exists: false}}, {$set: {claim:
   {worker, since}}}, {sort: {nextCheckAt: 1}})`. One atomic step picks and locks the oldest due
   tracker, so instances never share one. The `nextCheckAt` index is plain; the handful of claimed
   trackers is filtered after the index scan (partial indexes reject `$exists: false`).
2. Fetch the page through `fetcher`; insert a snapshot, or reuse the existing one when the content
   hash already exists (duplicate key 11000 is the normal "unchanged" case).
3. Extract the element text with the selector (planned: `cheerio`); the raw text is the value.
4. Insert an observation `{timestamp, trackerId, snapshotId, value}` or `{..., error}` when the
   selector matched nothing or the fetch failed; a failed check is still an observation.
5. Compare with `tracker.lastValue` and the condition; insert an event (`changed`,
   `condition-met`, `tracker-broken` after repeated failures) with `pending: true` and the values
   copied onto it.
6. Release: `$set lastValue, nextCheckAt = now + interval`, `$unset claim`, `failures` to 0 or
   `$inc` by 1.

Each step writes before the next starts. A crash between claim and release leaves the claim in
place; on start the worker releases claims carrying its own identity (`WORKER_INSTANCE` env), the
same pattern as Turbotendr's analyzer. No leases, no attempt counters beyond `failures`.

## Rules

- No timers per tracker: the schedule is `nextCheckAt` in the database, the worker polls for due
  work every few seconds and sleeps when there is none.
- Graceful shutdown on SIGTERM: stop claiming, finish the tracker in hand, release, exit; Docker
  gives ten seconds before SIGKILL.
- Observations are inserted through `insertObservation`; never update or delete them.
- Config from `process.env` in `main.ts`: `MONGODB_URI`, `FETCHER_URL`, `WORKER_INSTANCE`
  required; poll interval with a default.
