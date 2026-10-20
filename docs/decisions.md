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
