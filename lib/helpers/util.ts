import { LogLevel, LogService, MatrixClient, MatrixError } from "@vector-im/matrix-bot-sdk";
import Envs from "./env";

LogService.setLevel(LogLevel.WARN);

export async function getClientFromEnv(needAdmin = false) {
    const token = process.env.MX_ACCESS_TOKEN || process.env.MX_APPSERVICE_TOKEN;
    if (!token) {
        throw Error('No MX_ACCESS_TOKEN or MX_APPSERVICE_TOKEN defined');
    }
    const client = new MatrixClient(Envs.homeserver, token);
    if (needAdmin) {
        try {
            if (!await client.adminApis.synapse.isAdmin(await client.getUserId())) {
                throw Error('Access token is not admin');
            }
        } catch (ex) {
            if (ex instanceof MatrixError && ex.errcode === 'M_UNRECOGNIZED') {
                // Might be a MAS host, we can't check
            } else {
                throw ex;
            }
        }
    }
    await client.getWhoAmI();
    return client;
}

export function getASClientFromEnv(userId?: string) {
    if (!process.env.MX_APPSERVICE_TOKEN) {
        throw Error('No MX_APPSERVICE_TOKEN defined');
    }
    const client = new MatrixClient(Envs.homeserver, process.env.MX_APPSERVICE_TOKEN);
    if (userId) client.impersonateUserId(userId);
    return client;
}

export async function registerASUser(userId: string) {
    console.log(userId);
    if (!Envs.homeserver) {
        throw Error('No MX_HOMESERVER defined');
    }
    if (!process.env.MX_APPSERVICE_TOKEN) {
        throw Error('No MX_APPSERVICE_TOKEN defined');
    }
    const client = new MatrixClient(Envs.homeserver, process.env.MX_APPSERVICE_TOKEN);
    try {
        const result = await client.doRequest("POST", "/_matrix/client/r0/register", null, {
            type: "m.login.application_service",
            username: userId.substring(1).split(":")[0],
        });
    } catch (err) {
        if (err instanceof MatrixError) {
            if (err.errcode === "M_USER_IN_USE") {
                return;
            }
        }
        throw err;
    }
}

export async function getVictoriaMetricAvgValue(query: string): Promise<number> {
    try {
        const queryString = new URLSearchParams({
            start: ((Date.now() - 40000) / 1000).toString(),
            end: ((Date.now() - 10000) / 1000).toString(),
            step: "3s",
            query
        }).toString();
        const req = await fetch(new URL(`/prometheus/api/v1/query_range`, Envs.prometheusUrl), {
            "body": queryString.toString(),
            "method": "POST",
            "mode": "cors"
        });
        if (!req.ok) {
            console.warn(`VM metrics req not okay: ${req.status} ${req.statusText}`)
        }
        const data = await req.json();
        const values = data.data.result[0].values as Array<[number, string]>;
        const avg = values.map(([,b]) => parseFloat(b)).slice(-50);
        const value = avg.reduce((a,b) => a+b) / avg.length;;
        console.log('VM calculuated to be', value)
        return value;
    } catch (ex) {
        console.warn(`VM metrics error: ${ex}`);
        return 0;
    }
}