import type {FastifyPluginAsync} from "fastify";
import type {TypeBoxTypeProvider} from "@fastify/type-provider-typebox";
import {Type} from "@sinclair/typebox";
import {type Db, MongoServerError, ObjectId} from "mongodb";
import {fetchPage, findOrCreatePage, findPageById, insertSnapshot} from "@web-watcher/shared";
import {createHash} from "node:crypto";

export const pagesRoutes: FastifyPluginAsync<{ db: Db; fetcherUrl: string }> = async (app, {db, fetcherUrl}) => {
    const typed = app.withTypeProvider<TypeBoxTypeProvider>();

    typed.post("/pages", {schema: {body: Type.Object({url: Type.String({format: "uri"})})}}, async (request, reply) => {
        const {url} = request.body;

        // The fetcher already answers 400/413/415/502/504 with a message; pass it through unchanged.
        const outcome = await fetchPage(fetcherUrl, url);
        if (!outcome.ok) {
            return reply.code(outcome.status).send({message: outcome.message});
        }
        const {html} = outcome.result;

        const contentHash = createHash("sha256").update(html).digest("hex");
        const page = await findOrCreatePage(db, url);
        try {
            const snapshotId = await insertSnapshot(db, {pageId: page._id, fetchedAt: new Date(), contentHash, html});
            return reply.code(201).send({page, snapshotId, snapshotCreated: true});
        } catch (error) {
            // The same content was already stored: not a client error, the page simply has not changed.
            if (error instanceof MongoServerError && error.code === 11000) {
                return reply.code(200).send({page, snapshotCreated: false});
            }
            throw error;
        }
    });

    typed.get("/pages/:id", {schema: {params: Type.Object({id: Type.String()})}}, async (request, reply) => {
        const {id} = request.params;
        if (!ObjectId.isValid(id)) {
            return reply.code(400).send({message: "invalid id"});
        }

        const page = await findPageById(db, new ObjectId(id));
        if (!page) {
            return reply.code(404).send({message: "page not found"});
        }
        return page;
    });
};
