import {Type} from "@sinclair/typebox";
import type {FastifyPluginAsync} from "fastify";
import {Db, MongoServerError, ObjectId} from "mongodb";
import type {TypeBoxTypeProvider} from "@fastify/type-provider-typebox";
import {findOrCreatePage, findPageById, insertTracker} from "@web-watcher/shared";


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


export const trackerRoutes: FastifyPluginAsync<{ db: Db }> = async (app, {db}) => {
        const typed = app.withTypeProvider<TypeBoxTypeProvider>();

        typed.post("/trackers", {schema: {body: trackerBody}}, async (request, reply) => {
            const {pageId, ...draft} = request.body;

            try {
                await findOrCreatePage(db, pageId);
            } catch {
                return reply.code(404).send({message: "page not found"});
            }

            try {
                const trackerId = await insertTracker(db, {...draft, pageId: new ObjectId(pageId)})
                return reply.code(201).send({trackerId, trackerCreated: true});

            } catch (error) {
                if (error instanceof MongoServerError && error.code === 11000) {
                    return reply.code(200).send({trackerCreated: false});
                }
                throw error;
            }
        });

        typed.get("/tracker/:id", {schema: {params: Type.Object({id: Type.String()})}}, async (request, reply) => {
            const {id} = request.params;
            if (!ObjectId.isValid(id)) {
                return reply.code(400).send({message: "invalid id"});
            }

            const tracker = await findPageById(db, new ObjectId(id));
            if (!tracker) {
                return reply.code(404).send({message: "page not found"});
            }
            return tracker;
        });
    }
;