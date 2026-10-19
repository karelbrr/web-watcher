import {MongoClient} from "mongodb";

export async function connectMongo(uri: string): Promise<MongoClient> {
    const client = new MongoClient(uri, {ignoreUndefined: true});
    await client.connect();
    return client;
}