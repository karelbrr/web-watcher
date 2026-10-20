import {type Collection, type Db, type IndexDescription, ObjectId} from "mongodb";

export type TrackerKind = "price" | "availability" | "number" | "text" | "date" | "count";

export type TrackerCondition =
    | { type: "changed" }
    | { type: "below"; value: number }
    | { type: "above"; value: number }
    | { type: "contains"; text: string };

export interface Tracker {
    _id: ObjectId;
    pageId: ObjectId;
    name: string;
    kind: TrackerKind;
    selector: string;
    interval: number;
    condition?: TrackerCondition;
    nextCheckAt: Date;
    lastValue?: string;
    claim?: { worker: string; since: Date };
    failures: number;
    createdAt: Date;
}

export type TrackerDraft = Pick<Tracker, "pageId" | "name" | "kind" | "selector" | "interval" | "condition">;

const COLLECTION = "trackers";

export function getTrackers(db: Db): Collection<Tracker> {
    return db.collection<Tracker>(COLLECTION);
}

// A partial filter on `claim: {$exists: false}` is not allowed (partial indexes accept no negations),
// so the worker's query filters the few claimed trackers out of the index range itself.
export const TRACKER_INDEXES: IndexDescription[] = [
    {key: {nextCheckAt: 1}},
    {key: {pageId: 1}},
];

export async function insertTracker(db: Db, draft: TrackerDraft): Promise<Tracker> {
    const now = new Date();
    const tracker: Tracker = {_id: new ObjectId(), ...draft, nextCheckAt: now, failures: 0, createdAt: now};
    await getTrackers(db).insertOne(tracker);
    return tracker;
}

export async function findTrackerById(db: Db, id: ObjectId): Promise<Tracker | null> {
    return getTrackers(db).findOne({_id: id});
}

export async function findTrackersByPage(db: Db, pageId: ObjectId): Promise<Tracker[]> {
    return getTrackers(db).find({pageId}).sort({createdAt: 1}).toArray();
}
