import {buildApp} from "./app.js";

const port = Number(process.env.FETCHER_PORT ?? 3001);

const app = await buildApp();
await app.listen({port, host: "0.0.0.0"});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
        void app.close();
    });
}
