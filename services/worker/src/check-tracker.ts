import type {Logger} from "pino";
import {type Db, MongoServerError, type ObjectId} from "mongodb";
import {
    extractValue,
    fetchPage,
    findLatestSnapshot,
    findPageById,
    insertObservation,
    insertSnapshot,
    type Tracker,
} from "@web-watcher/shared";
import {createHash} from "node:crypto";

export async function checkTracker(db: Db, fetcherUrl: string, tracker: Tracker, now: Date, log: Logger): Promise<string | null> {
    const page = await findPageById(db, tracker.pageId);
    if (!page) {
        log.error({pageId: tracker.pageId}, "tracker points to a missing page");
        return null;
    }

    const outcome = await fetchPage(fetcherUrl, page.url);
    if (!outcome.ok) {
        log.warn({status: outcome.status, message: outcome.message}, "fetch failed");
        await insertObservation(db, {timestamp: now, trackerId: tracker._id, error: outcome.message});
        return null;
    }

    const html = outcome.result.html;
    const snapshotId = await storeSnapshot(db, page._id, html, now);

    // The snapshot is stored even when the selector fails, so the html is there for a later repair.
    const value = extractValue(html, tracker.selector);
    if (value === null) {
        log.warn({selector: tracker.selector}, "selector matched nothing");
        await insertObservation(db, {
            timestamp: now,
            trackerId: tracker._id,
            snapshotId,
            error: "selector matched nothing"
        });
        return null;
    }
    await insertObservation(db, {timestamp: now, trackerId: tracker._id, snapshotId, value});
    log.info({snapshotId, value}, "observed");
    return value;

}

// Returns the id of the snapshot holding this html: a new one, or the latest existing one when
// the content hash is already stored (the unique index answers with a duplicate key).
async function storeSnapshot(db: Db, pageId: ObjectId, html: string, now: Date): Promise<ObjectId> {
    const contentHash = createHash("sha256").update(html).digest("hex");
    try {
        return await insertSnapshot(db, {pageId, fetchedAt: now, contentHash, html});
    } catch (error) {
        if (!(error instanceof MongoServerError && error.code === 11000)) {
            throw error;
        }
    }
    const existing = await findLatestSnapshot(db, pageId);
    if (!existing) {
        throw new Error(`snapshot with hash ${contentHash} exists for page ${pageId.toString()} but cannot be read`);
    }
    return existing._id;
}
