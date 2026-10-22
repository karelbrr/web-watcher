# services/notifier

Not implemented yet (`main.ts` is empty). This file records the agreed design; update it as the
service takes shape.

## Role

Delivers events to Telegram and answers a `/status` bot command with an overview of trackers and
recent changes. It is a separate service so that change streams have a real consumer: it follows
`events` and reacts to inserts instead of polling.

## Design

- Opens a change stream on `events` filtered to inserts; sends one Telegram message per event
  (`previousValue → value`, tracker name, page url) through the Bot API with a single `POST`.
- After sending: `updateOne({_id}, {$unset: {pending: ""}, $set: {notifiedAt}})`. `pending` is the
  positive marker the partial index `{timestamp: 1}` on `{pending: true}` is built on; it is never
  set to `false`.
- Persists the stream's `resumeToken` in Mongo after each handled event and resumes from it on
  start, so a restart loses nothing. On first start, or when the token is too old for the oplog,
  it drains `findPendingEvents` first and then opens the stream.
- Change streams need a replica set; until Compose runs one (phase 4), the notifier can poll
  `findPendingEvents` every few seconds behind the same interface.
- Idempotence: a message may be sent twice after a crash between send and `$unset`; accepted, a
  duplicate Telegram message is harmless.

## Rules

- Config from `process.env`: `MONGODB_URI`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` required.
  The token never appears in logs or responses.
- Sits in the `internal` network only; Telegram is reached through an egress rule added when the
  service exists (the fetcher pattern), not by giving every service internet access.
