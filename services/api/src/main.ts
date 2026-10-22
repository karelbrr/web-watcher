import {connectMongo} from "@web-watcher/shared";
import {buildApp} from "./app.js";

const port = Number(process.env.API_PORT ?? 3000);
const uri = process.env.MONGODB_URI;
if (!uri) {
    throw new Error("MONGODB_URI is not set");
}
const fetcherUrl = process.env.FETCHER_URL;
if (!fetcherUrl) {
    throw new Error("FETCHER_URL is not set");
}

const client = await connectMongo(uri);
const db = client.db();

const app = await buildApp(db, fetcherUrl);
await app.listen({port, host: "0.0.0.0"});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
        void app.close().then(() => client.close());
    });
}
