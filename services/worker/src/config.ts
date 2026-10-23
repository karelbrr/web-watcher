export interface WorkerConfig {
    mongoUri: string;
    fetcherUrl: string;
    instance: string;
    pollIntervalMs: number;
}

export function readConfig(env: NodeJS.ProcessEnv): WorkerConfig {
    return {
        mongoUri: required(env, "MONGODB_URI"),
        fetcherUrl: required(env, "FETCHER_URL"),
        instance: required(env, "WORKER_INSTANCE"),
        pollIntervalMs: Number(env.POLL_INTERVAL_MS ?? 5000),
    };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
    const value = env[name];
    if (!value) {
        throw new Error(`${name} is not set`);
    }
    return value;
}
