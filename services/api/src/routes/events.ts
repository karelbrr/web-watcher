import type {FastifyPluginAsync} from "fastify";
import type {TypeBoxTypeProvider} from "@fastify/type-provider-typebox";
import {Type} from "@sinclair/typebox";
import {type Db, ObjectId} from "mongodb";
import {
    findEventsByTracker,

    findPendingEvents,
    findRecentEvents, findTrackerById,

} from "@web-watcher/shared";

const idParams = Type.Object({id: Type.String()});

export const eventsRoutes: FastifyPluginAsync<{ db: Db }> = async (app, {db}) => {
    const typed = app.withTypeProvider<TypeBoxTypeProvider>();

    const eventsQuery = Type.Object({
        pending: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Integer({minimum: 1, maximum: 500})),
    });

    const trackerEventsQuery = Type.Object({
        limit: Type.Optional(Type.Integer({minimum: 1, maximum: 500})),
    });

    typed.get("/trackers/:id/events", {
        schema: {
            params: idParams,
            querystring: trackerEventsQuery
        }
    }, async (request, reply) => {
        const {id} = request.params;
        if (!ObjectId.isValid(id)) {
            return reply.code(400).send({message: "invalid id"});
        }

        const tracker = await findTrackerById(db, new ObjectId(id));
        if (!tracker) {
            return reply.code(404).send({message: "tracker not found"});
        }

        const {limit = 50} = request.query;
        return findEventsByTracker(db, tracker._id, limit);
    });


    typed.get("/events", {schema: {querystring: eventsQuery}}, async (request) => {
        const {pending, limit = 50} = request.query;
        return pending ? findPendingEvents(db, limit) : findRecentEvents(db, limit);
    });
};
