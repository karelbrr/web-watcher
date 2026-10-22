import type {FastifyPluginAsync} from "fastify";
import type {TypeBoxTypeProvider} from "@fastify/type-provider-typebox";
import {Type} from "@sinclair/typebox";
import type {FetchResult} from "@web-watcher/shared";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES = 10 * 1024 * 1024;

export const fetchRoutes: FastifyPluginAsync = async (app) => {
    const typed = app.withTypeProvider<TypeBoxTypeProvider>();

    typed.post("/fetch", {schema: {body: Type.Object({url: Type.String({format: "uri"})})}}, async (request, reply) => {
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

        const result: FetchResult = {status: response.status, contentType, html};
        return result;
    });
};
