import {type Collection, type Db, type IndexDescription, ObjectId} from "mongodb";

export interface Page {
    _id: ObjectId;
    url: string;
    createdAt: Date;
}

const COLLECTION = "pages";

export function getPages(db: Db): Collection<Page> {
    return db.collection<Page>(COLLECTION);
}

export const PAGE_INDEXES: IndexDescription[] = [
    {key: {url: 1}, unique: true},
];

// An upsert rather than find-then-insert, so two concurrent requests for the same url
// cannot both miss the lookup and race on the unique index.
export async function findOrCreatePage(db: Db, url: string): Promise<Page> {
    const page = await getPages(db).findOneAndUpdate(
        {url},
        {$setOnInsert: {_id: new ObjectId(), url, createdAt: new Date()}},
        {upsert: true, returnDocument: "after"},
    );
    if (!page) {
        throw new Error(`upsert of page ${url} returned no document`);
    }
    return page;
}

export async function findPageById(db: Db, id: ObjectId): Promise<Page | null> {
    return getPages(db).findOne({_id: id});
}
