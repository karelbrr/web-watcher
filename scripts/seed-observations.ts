import {connectMongo, getObservations, getTrackers, type Observation} from "@web-watcher/shared";
import {ObjectId} from "mongodb";

const STEP_MS = 5 * 60 * 1000;
const COUNT_PER_TRACKER = 350_000;
const BATCH_SIZE = 10_000;
const BASE_PRICE = 4990;
const PRICE_SPREAD = 200;
const ERROR_EVERY = 50;

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) throw new Error("MONGODB_URI is not set");

const client = await connectMongo(mongoUri);
const startedAt = Date.now();
try {
    const db = client.db();
    const trackers = await getTrackers(db).find().limit(3).toArray();
    if (trackers.length < 3) throw new Error(`need 3 trackers, found ${trackers.length}`);

    const now = Date.now();
    for (const tracker of trackers) {
        for (let offset = 0; offset < COUNT_PER_TRACKER; offset += BATCH_SIZE) {
            const batch: Observation[] = [];
            for (let i = offset; i < offset + BATCH_SIZE; i++) {
                const timestamp = new Date(now - i * STEP_MS);
                if (i % ERROR_EVERY === 0) {
                    batch.push({
                        _id: new ObjectId(),
                        timestamp,
                        trackerId: tracker._id,
                        error: "selector matched nothing"
                    });
                } else {
                    const price = BASE_PRICE + Math.round((Math.random() * 2 - 1) * PRICE_SPREAD);
                    batch.push({
                        _id: new ObjectId(),
                        timestamp,
                        trackerId: tracker._id,
                        value: `${formatPrice(price)} Kč`
                    });
                }
            }
            await getObservations(db).insertMany(batch, {ordered: false});
            console.log(`${tracker.name}: ${offset + BATCH_SIZE} / ${COUNT_PER_TRACKER}`);
        }
    }
} finally {
    await client.close();
}
console.log(`done in ${((Date.now() - startedAt) / 1000).toFixed(1)} s`);

// "4 790", the way the test page prints prices, so the seed looks like real observations.
function formatPrice(price: number): string {
    return price.toLocaleString("cs-CZ").replace(/\u00a0/g, " ");
}
