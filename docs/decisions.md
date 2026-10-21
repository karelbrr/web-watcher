# Decisions

One line per decision: what and why. Newest at the bottom.

- 2026-10-18: Monorepo with npm workspaces, one package per service plus `shared` for types and
  collection modules, because the services share the Mongo model and the TS types.
- 2026-10-18: Native MongoDB driver, no ODM; one module per collection owns its type, indexes and
  read/write functions.
- 2026-10-19: Indexes are created by `npm run ensure-indexes` at deploy time, never by a service at
  startup: an index build on a large collection takes minutes and would block every restart, and four
  services sharing the collections would all race to do the same work.
- 2026-10-19: `pages` is unique on `url` + `contentHash`, not on `url` alone, so a page whose content
  changed is stored again as a new snapshot while an unchanged page is rejected by the index.
- 2026-10-20: The Mongo container publishes host port 27018, not 27017, because a Homebrew `mongod`
  for work already owns 27017 on this machine and silently received every host-side connection.
  Inside the Compose network the services keep `mongo:27017`.
- 2026-10-20: `trackers.nextCheckAt` has a plain index, not a partial one on unclaimed trackers,
  because MongoDB rejects `$exists: false` in a partial filter. The worker's query adds
  `claim: {$exists: false}` and the handful of in-flight trackers are filtered after the index scan.
- 2026-10-21: `observations` queries always lead with `trackerId` and a `timestamp` range; a filter on
  `value` is allowed only behind them. Measured on 78k observations (274 buckets): tracker + one
  week reads 25 buckets in 3 ms, tracker alone scans all 274 in 22 ms, `value` alone scans all 274
  and unpacks every observation in 42 ms. Nothing inside a bucket is indexed.
- 2026-10-21: The 90-day TTL on `observations` deleted most of the seed within a minute of insertion
  (3.3 years generated, 90 days kept). Expected, and the first proof the retention works.
- 2026-10-21: Open: `value` is stored as the raw element text ("4 790 Kč"). Aggregating prices needs
  `$replaceAll` + `$toInt` per document; revisit once it is clear what gets computed from observations.
