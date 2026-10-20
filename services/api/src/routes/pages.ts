import type {FastifyPluginAsync} from "fastify";
import type {TypeBoxTypeProvider} from "@fastify/type-provider-typebox";
import {Type} from "@sinclair/typebox";
import {type Db, MongoServerError, ObjectId} from "mongodb";
import {findOrCreatePage, findPageById, insertSnapshot,} from "@web-watcher/shared";

import {createHash} from "node:crypto";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES = 10 * 1024 * 1024;

export const pagesRoutes: FastifyPluginAsync<{ db: Db }> = async (app, {db}) => {
    const typed = app.withTypeProvider<TypeBoxTypeProvider>();

    typed.post("/pages", {schema: {body: Type.Object({url: Type.String({format: "uri"})})}}, async (request, reply) => {
        const {url} = request.body;

        // "uri" format also accepts ftp:, file: or mailto:, which fetch cannot download.
        const protocol = new URL(url).protocol;
        if (protocol !== "http:" && protocol !== "https:") {
            return reply.code(400).send({message: "only http and https urls are supported"});
        }

        let response: Response;
        try {
            response = await fetch(url, {signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: "follow"});
        } catch (error) {
            if (error instanceof DOMException && error.name === "TimeoutError") {
                return reply.code(504).send({message: `page did not answer within ${FETCH_TIMEOUT_MS / 1000} s`});
            }
            return reply.code(502).send({message: "page could not be fetched"});
        }

        if (!response.ok) {
            return reply.code(502).send({message: `page answered ${response.status}`});
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("text/html")) {
            return reply.code(415).send({message: `page is ${contentType || "of unknown type"}, not text/html`});
        }

        const contentLength = Number(response.headers.get("content-length"));
        if (contentLength > MAX_HTML_BYTES) {
            return reply.code(413).send({message: `page is larger than ${MAX_HTML_BYTES} bytes`});
        }

        let html: string;
        try {
            html = await response.text();
        } catch {
            return reply.code(502).send({message: "page body could not be read"});
        }
        // A server that sends no content-length is only measured once the body is read.
        if (Buffer.byteLength(html) > MAX_HTML_BYTES) {
            return reply.code(413).send({message: `page is larger than ${MAX_HTML_BYTES} bytes`});
        }

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
