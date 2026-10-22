import Fastify, {type FastifyInstance} from "fastify";
import type {Db} from "mongodb";
import {pagesRoutes} from "./routes/pages.js";
import {trackersRoutes} from "./routes/trackers.js";
import {eventsRoutes} from "./routes/events.js";

export async function buildApp(db: Db, fetcherUrl: string): Promise<FastifyInstance> {
    const app = Fastify({logger: true});
    app.get("/health", () => ({ok: true}));
    await app.register(pagesRoutes, {db, fetcherUrl});
    await app.register(trackersRoutes, {db});
    await app.register(eventsRoutes, {db});
    return app;
}
