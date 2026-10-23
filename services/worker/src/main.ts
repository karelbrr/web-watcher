import pino from "pino";
import {claimDueTracker, connectMongo, releaseClaimsOf, releaseTracker} from "@web-watcher/shared";
import {readConfig} from "./config.js";
import {setTimeout as sleep} from "node:timers/promises";
import {checkTracker} from "./check-tracker.js";

const config = readConfig(process.env);
const log = pino({base: {instance: config.instance}});

const client = await connectMongo(config.mongoUri);
const db = client.db();
log.info("connected");

const released = await releaseClaimsOf(db, config.instance);
log.info({released}, "released claims from a previous run");

let running = true;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
        log.info({signal}, "shutting down after the current iteration");
        running = false;
    });
}

while (running) {
    const now = new Date();
    const tracker = await claimDueTracker(db, config.instance, now);
    if (!tracker) {
        await sleep(config.pollIntervalMs);
        continue;
    }
    const trackerLog = log.child({trackerId: tracker._id, name: tracker.name});
    trackerLog.info("claimed");
    try {
        await checkTracker(db, config.fetcherUrl, tracker, now, trackerLog);
    } catch (error) {
        // The tracker is released below whatever happened, otherwise it would stay locked until a restart.
        trackerLog.error({error}, "check failed");
    }
    await releaseTracker(db, tracker._id, new Date(now.getTime() + tracker.interval * 1000));
}

await client.close();
log.info("stopped");