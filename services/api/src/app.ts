import Fastify, {type FastifyInstance} from "fastify";
import type {Db} from "mongodb";
import {pagesRoutes} from "./routes/pages.js";
import {trackersRoutes} from "./routes/trackers.js";

export async function buildApp(db: Db): Promise<FastifyInstance> {
    const app = Fastify({logger: true});
    app.get("/health", async () => ({ok: true}));
    await app.register(pagesRoutes, {db});
    await app.register(trackersRoutes, {db});
    return app;
}
