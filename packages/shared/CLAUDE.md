# packages/shared

Types, the Mongo connection and one module per collection, shared by every service. Nothing here
knows about HTTP or `process.env`; a function takes a `Db` and plain values.

## Modules

| Module            | Collection     | Owns                                                                 |
|-------------------|----------------|----------------------------------------------------------------------|
| `mongo.ts`        |                | `connectMongo(uri)` with `ignoreUndefined: true`                     |
| `pages.ts`        | `pages`        | `Page`, unique `url`, `findOrCreatePage` (upsert), `findPageById`    |
| `snapshots.ts`    | `snapshots`    | `Snapshot` with gzip `Binary` html, unique `pageId + contentHash`, `insertSnapshot`, `findLatestSnapshot`, `readSnapshotHtml` |
| `trackers.ts`     | `trackers`     | `Tracker`, `TrackerKind`, `TrackerCondition`, `nextCheckAt` index, `insertTracker`, `findTrackerById`, `findTrackersByPage` |
| `observations.ts` | `observations` | `Observation`, time series (`timestamp` time, `trackerId` meta, 90-day TTL), `ensureObservationsCollection`, `insertObservation`, `findObservations` |
| `events.ts`       | `events`       | `Event`, `EventKind`, `pending` partial index, `findEventsByTracker`, `findPendingEvents`, `findRecentEvents` |
| `fetch-result.ts` |                | `FetchResult`, the fetcher's response shape                          |

Every collection module follows the same order: type, `COLLECTION` name, `getXxx(db)`, `XXX_INDEXES`
(an `IndexDescription[]` consumed by `scripts/ensure-indexes.ts`), then functions. Other code
imports the functions, never the `Collection` handle.

## Rules learned here

- A draft type is `Omit<T, "_id">` or a `Pick` of the fields the caller supplies; `insert*`
  generates `_id` and fills defaults. A separate draft type exists when the stored shape differs
  from the input (`SnapshotDraft` takes `html: string`, the document stores `Binary`).
- `insertMany` on `Collection<T>` requires `_id` because the types declare it; the seed script
  generates it itself.
- Partial indexes accept no negation: `$exists: false` is rejected. Use a positive marker instead
  (`events.pending: true`, removed with `$unset` when done) or a plain index with the filter in the
  query (`trackers.nextCheckAt`, the worker adds `claim: {$exists: false}`).
- `observations` is a time series collection: it must be created explicitly (`createCollection`
  with `timeseries` and `expireAfterSeconds`), it has no unique indexes, documents are never
  updated, and MongoDB adds the `{trackerId: 1, timestamp: 1}` index itself. Queries always lead
  with `trackerId` and a `timestamp` range; a filter on `value` scans and unpacks every bucket.
- Values from pages are stored as the raw element text (`"4 790 Kč"`); conversion by `kind`
  happens when reading. Recorded as an open decision in `docs/decisions.md`.
- A snapshot is frozen history: never propagated to, never "fixed".

## Changing a collection

1. Edit the type and functions in its module.
2. Change `XXX_INDEXES`; if an existing index changes shape, drop it by hand first.
3. `npm run build`, then `MONGODB_URI=mongodb://localhost:27018/web-watcher npm run ensure-indexes`.
4. Add the decision to `docs/decisions.md`.
