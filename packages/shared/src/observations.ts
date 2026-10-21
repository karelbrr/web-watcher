import {type Collection, type Db, ObjectId} from "mongodb";

export interface Observation {
    _id: ObjectId;
    timestamp: Date;
    observationId: ObjectId;
    snapshotId?: ObjectId;
    value?: string;
    error?: string;
}

export type ObservationDraft = Omit<Observation, "_id">;

const COLLECTION = "observations";
const RETENTION_SECONDS = 90 * 24 * 60 * 60;

export function getObservations(db: Db): Collection<Observation> {
    return db.collection<Observation>(COLLECTION);
}

// A time series collection cannot be created by the first insert: its time and meta fields,
// granularity and expiry are fixed at creation, so ensure-indexes creates it explicitly.
// MongoDB adds the {observationId: 1, timestamp: 1} index itself; no other index is needed for
// "history of one observation in a time range".
export async function ensureObservationsCollection(db: Db): Promise<boolean> {
    const existing = await db.listCollections({name: COLLECTION}, {nameOnly: true}).toArray();
    if (existing.length > 0) {
        return false;
    }
    await db.createCollection(COLLECTION, {
        timeseries: {timeField: "timestamp", metaField: "observationId", granularity: "minutes"},
        expireAfterSeconds: RETENTION_SECONDS,
    });
    return true;
}

export async function insertObservation(db: Db, draft: ObservationDraft): Promise<ObjectId> {
    const result = await getObservations(db).insertOne({_id: new ObjectId(), ...draft});
    return result.insertedId;
}

export async function findObservations(db: Db, trackerId: ObjectId, from: Date, to: Date): Promise<Observation[]> {
    return getObservations(db)
        .find({trackerId, timestamp: {$gte: from, $lte: to}})
        .sort({timestamp: -1})
        .toArray();
}