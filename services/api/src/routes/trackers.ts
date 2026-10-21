import {Type} from "@sinclair/typebox";
import type {FastifyPluginAsync} from "fastify";
import {type Db, ObjectId} from "mongodb";
import type {TypeBoxTypeProvider} from "@fastify/type-provider-typebox";
import {findObservations, findPageById, findTrackerById, findTrackersByPage, insertTracker} from "@web-watcher/shared";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const trackerKind = Type.Union([
    Type.Literal("price"), Type.Literal("availability"), Type.Literal("number"),
    Type.Literal("text"), Type.Literal("date"), Type.Literal("count"),
]);

const trackerCondition = Type.Union([
    Type.Object({type: Type.Literal("changed")}),
    Type.Object({type: Type.Literal("below"), value: Type.Number()}),
    Type.Object({type: Type.Literal("above"), value: Type.Number()}),
    Type.Object({type: Type.Literal("contains"), text: Type.String({minLength: 1})}),
]);

const trackerBody = Type.Object({
    pageId: Type.String(),
    name: Type.String({minLength: 1, maxLength: 100}),
    kind: trackerKind,
    selector: Type.String({minLength: 1}),
    interval: Type.Integer({minimum: 60}),
    condition: Type.Optional(trackerCondition),
});

const idParams = Type.Object({id: Type.String()});

const historyQuery = Type.Object({
    from: Type.Optional(Type.String({format: "date-time"})),
    to: Type.Optional(Type.String({format: "date-time"})),
});

export const trackersRoutes: FastifyPluginAsync<{ db: Db }> = async (app, {db}) => {
    const typed = app.withTypeProvider<TypeBoxTypeProvider>();

    typed.post("/trackers", {schema: {body: trackerBody}}, async (request, reply) => {
        const {pageId, ...draft} = request.body;
        if (!ObjectId.isValid(pageId)) {
            return reply.code(400).send({message: "invalid pageId"});
        }

        const page = await findPageById(db, new ObjectId(pageId));
        if (!page) {
            return reply.code(404).send({message: "page not found"});
        }

        const tracker = await insertTracker(db, {...draft, pageId: page._id});
        return reply.code(201).send(tracker);
    });

    typed.get("/trackers/:id", {schema: {params: idParams}}, async (request, reply) => {
        const {id} = request.params;
        if (!ObjectId.isValid(id)) {
            return reply.code(400).send({message: "invalid id"});
        }

        const tracker = await findTrackerById(db, new ObjectId(id));
        if (!tracker) {
            return reply.code(404).send({message: "tracker not found"});
        }
        return tracker;
    });

    typed.get("/pages/:id/trackers", {schema: {params: idParams}}, async (request, reply) => {
        const {id} = request.params;
        if (!ObjectId.isValid(id)) {
            return reply.code(400).send({message: "invalid id"});
        }

        const page = await findPageById(db, new ObjectId(id));
        if (!page) {
            return reply.code(404).send({message: "page not found"});
        }
        return findTrackersByPage(db, page._id);
    });

    typed.get("/trackers/:id/history", {
        schema: {
            params: idParams,
            querystring: historyQuery
        }
    }, async (request, reply) => {
        const {id} = request.params;
        if (!ObjectId.isValid(id)) {
            return reply.code(400).send({message: "invalid id"});
        }

        const to = request.query.to ? new Date(request.query.to) : new Date();
        const from = request.query.from ? new Date(request.query.from) : new Date(to.getTime() - WEEK_MS);
        if (from > to) {
            return reply.code(400).send({message: "from must not be after to"});
        }

        const tracker = await findTrackerById(db, new ObjectId(id));
        if (!tracker) {
            return reply.code(404).send({message: "tracker not found"});
        }
        return findObservations(db, tracker._id, from, to);
    });
};
