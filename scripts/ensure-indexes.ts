import {connectMongo, getPages, PAGE_INDEXES} from "@web-watcher/shared";

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) throw new Error("MONGODB_URI is not set");

const client = await connectMongo(mongoUri);
try {
    const db = client.db();
    const created = await getPages(db).createIndexes(PAGE_INDEXES);
    console.log("pages:", created.join(", "));
} finally {
    await client.close();
}