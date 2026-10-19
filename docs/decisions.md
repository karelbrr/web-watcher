# Decisions

One line per decision: what and why. Newest at the bottom.

- 2026-10-18: Monorepo with npm workspaces, one package per service plus `shared` for types and
  collection modules, because the services share the Mongo model and the TS types.
- 2026-10-18: Native MongoDB driver, no ODM; one module per collection owns its type, indexes and
  read/write functions.
