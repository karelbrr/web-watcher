# web-watcher

A service that fetches a web page, lets AI propose what on it can be tracked, and then watches the
chosen values and reports changes.

Services: `api` (HTTP), `fetcher` (page downloads), `worker` (checks), `notifier` (Telegram),
`mongo`. Shared types and collection modules live in `packages/shared`.

See `docs/decisions.md` for the design log.
