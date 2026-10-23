import type {Logger} from "pino";
import {type Db, MongoServerError, type ObjectId} from "mongodb";
import {
    fetchPage,
    findLatestSnapshot,
    findPageById,
    insertObservation,
    insertSnapshot,
    type Tracker,
} from "@web-watcher/shared";
import {createHash} from "node:crypto";

export async function checkTracker(db: Db, fetcherUrl: string, tracker: Tracker, now: Date, log: Logger): Promise<void> {
    const page = await findPageById(db, tracker.pageId);
    if (!page) {
        log.error({pageId: tracker.pageId}, "tracker points to a missing page");
        return;
    }

    const outcome = await fetchPage(fetcherUrl, page.url);
    if (!outcome.ok) {
        log.warn({status: outcome.status, message: outcome.message}, "fetch failed");
        await insertObservation(db, {timestamp: now, trackerId: tracker._id, error: outcome.message});
        return;
    }

    const html = outcome.result.html;
    const snapshotId = await storeSnapshot(db, page._id, html, now);

    // Extraction by selector comes next; until then the value only proves the observation exists.
    const value = `${html.length} chars`;
    await insertObservation(db, {timestamp: now, trackerId: tracker._id, snapshotId, value});
    log.info({snapshotId, value}, "observed");
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
