import {type Collection, type Db, type IndexDescription, ObjectId} from "mongodb";

export type EventKind = "changed" | "condition-met" | "tracker-broken";

export interface Event {
    _id: ObjectId;
    trackerId: ObjectId;
    kind: EventKind;
    timestamp: Date;
    observationId: ObjectId;
    previousValue?: string;
    value?: string;
    pending?: true;
    notifiedAt?: Date;
}


const COLLECTION = "events";

export function getEvents(db: Db): Collection<Event> {
    return db.collection<Event>(COLLECTION);
}

// `pending: true` is set at creation and removed once notified, so the notifier's index stays
// partial on a positive condition (`$exists: false` is not allowed in a partial filter) and holds
// only the events still waiting.
export const EVENT_INDEXES: IndexDescription[] = [
    {key: {trackerId: 1, timestamp: -1}},
    {key: {timestamp: 1}, partialFilterExpression: {pending: true}},
];

export async function findEventsByTracker(db: Db, trackerId: ObjectId, limit: number): Promise<Event[]> {
    return getEvents(db).find({trackerId}).sort({timestamp: -1}).limit(limit).toArray();
}

export async function findPendingEvents(db: Db, limit: number): Promise<Event[]> {
    return getEvents(db).find({pending: true}).sort({timestamp: 1}).limit(limit).toArray();
}

export async function findRecentEvents(db: Db, limit: number): Promise<Event[]> {
    return getEvents(db).find().sort({timestamp: -1}).limit(limit).toArray();
}