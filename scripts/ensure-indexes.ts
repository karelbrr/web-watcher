import {
    connectMongo, ensureObservationsCollection,
    getPages,
    getSnapshots,
    PAGE_INDEXES,
    SNAPSHOT_INDEXES,
    TRACKER_INDEXES
} from "@web-watcher/shared";

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) throw new Error("MONGODB_URI is not set");

const client = await connectMongo(mongoUri);
try {
    const db = client.db();

    const created = await ensureObservationsCollection(db);
    console.log("observations:", created ? "created (time series, 90 days)" : "exists");
    console.log("pages:", (await getPages(db).createIndexes(PAGE_INDEXES)).join(", "));
    console.log("snapshots:", (await getSnapshots(db).createIndexes(SNAPSHOT_INDEXES)).join(", "));
    console.log("trackers:", (await getSnapshots(db).createIndexes(TRACKER_INDEXES)).join(", "));
} finally {
    await client.close();
}
