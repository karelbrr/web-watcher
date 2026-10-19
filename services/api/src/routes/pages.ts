import type {FastifyPluginAsync} from "fastify";
import type {TypeBoxTypeProvider} from "@fastify/type-provider-typebox";
import {Type} from "@sinclair/typebox";
import {type Db, MongoServerError, ObjectId} from "mongodb";
import {findPageById, insertPage} from "@web-watcher/shared";
import {createHash} from "node:crypto";

export const pagesRoutes: FastifyPluginAsync<{ db: Db }> = async (app, {db}) => {
    const typed = app.withTypeProvider<TypeBoxTypeProvider>();

    typed.post("/pages", {schema: {body: Type.Object({url: Type.String({format: "uri"})})}}, async (request, reply) => {
        const {url} = request.body;

        let html: string;
        try {
            const response = await fetch(url, {signal: AbortSignal.timeout(15000)});
            html = await response.text();
        } catch {
            return reply.code(502).send({message: "page could not be fetched"});
        }

        const contentHash = createHash("sha256").update(html).digest("hex");
        try {
            const _id = await insertPage(db, {url, fetchedAt: new Date(), contentHash, html});
            return reply.code(201).send({_id});
        } catch (error) {
            if (error instanceof MongoServerError && error.code === 11000) {
                return reply.code(409).send({message: "page already stored"});
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
