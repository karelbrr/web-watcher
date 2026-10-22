import Fastify, {type FastifyInstance} from "fastify";
import {fetchRoutes} from "./routes/fetch.js";

export async function buildApp(): Promise<FastifyInstance> {
    const app = Fastify({logger: true});
    app.get("/health", () => ({ok: true}));
    await app.register(fetchRoutes);
    return app;
}
