import {Binary, type Collection, type Db, type IndexDescription, ObjectId} from "mongodb";
import {promisify} from "node:util";
import {gunzip, gzip} from "node:zlib";

export interface Snapshot {
    _id: ObjectId;
    pageId: ObjectId;
    fetchedAt: Date;
    contentHash: string;
    html: Binary;
}

export interface SnapshotDraft {
    pageId: ObjectId;
    fetchedAt: Date;
    contentHash: string;
    html: string;
}

const COLLECTION = "snapshots";
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export function getSnapshots(db: Db): Collection<Snapshot> {
    return db.collection<Snapshot>(COLLECTION);
}

export const SNAPSHOT_INDEXES: IndexDescription[] = [
    {key: {pageId: 1, contentHash: 1}, unique: true},
    {key: {pageId: 1, fetchedAt: -1}},
];

export async function insertSnapshot(db: Db, draft: SnapshotDraft): Promise<ObjectId> {
    const html = new Binary(await gzipAsync(draft.html));
    const result = await getSnapshots(db).insertOne({_id: new ObjectId(), ...draft, html});
    return result.insertedId;
}

export async function findLatestSnapshot(db: Db, pageId: ObjectId): Promise<Omit<Snapshot, "html"> | null> {
    return getSnapshots(db).findOne({pageId}, {projection: {html: 0}, sort: {fetchedAt: -1}});
}

export async function readSnapshotHtml(db: Db, id: ObjectId): Promise<string | null> {
    const snapshot = await getSnapshots(db).findOne({_id: id}, {projection: {html: 1}});
    if (!snapshot) {
        return null;
    }
    return (await gunzipAsync(snapshot.html.buffer)).toString("utf8");
}
