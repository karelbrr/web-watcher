import {type Collection, type Db, type IndexDescription, ObjectId} from "mongodb";

export interface Page {
    _id: ObjectId;
    url: string;
    fetchedAt: Date;
    contentHash: string;
    html: string;
}

const COLLECTION = "pages";

export function getPages(db: Db): Collection<Page> {
    return db.collection<Page>(COLLECTION);
}

export const PAGE_INDEXES: IndexDescription[] = [
    {key: {url: 1, contentHash: 1}, unique: true},
];

export async function insertPage(db: Db, page: Omit<Page, "_id">): Promise<ObjectId> {
    const result = await getPages(db).insertOne({_id: new ObjectId(), ...page});
    return result.insertedId;
}

export async function findPageById(db: Db, id: ObjectId): Promise<Omit<Page, "html"> | null> {
    return getPages(db).findOne({_id: id}, {projection: {html: 0}});
}