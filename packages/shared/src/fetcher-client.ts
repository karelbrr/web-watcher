import type {FetchResult} from "./fetch-result.js";

// A failed download is an ordinary outcome for the worker (it becomes an observation with an
// error), not an exception, so the result is a discriminated union rather than a throw.
export type FetchOutcome =
    | { ok: true; result: FetchResult }
    | { ok: false; status: number; message: string };

export async function fetchPage(fetcherUrl: string, url: string): Promise<FetchOutcome> {
    let response: Response;
    try {
        response = await fetch(`${fetcherUrl}/fetch`, {
            method: "POST",
            headers: {"content-type": "application/json"},
            body: JSON.stringify({url}),
        });
    } catch {
        return {ok: false, status: 502, message: "fetcher unavailable"};
    }

    if (!response.ok) {
        const {message} = (await response.json()) as {message: string};
        return {ok: false, status: response.status, message};
    }
    return {ok: true, result: (await response.json()) as FetchResult};
}
